"use client"

import { Download, Plus, Save, Trash2, Copy, Upload } from "lucide-react"
import { useState, useEffect, useRef, useMemo } from "react"
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';  // For nice tables

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { toast } from "@/components/ui/use-toast"
import { calculateCutsAction } from "./functions"

interface Panel {
    width: number
    length: number
    quantity: number
}

interface Sheet {
    cuts: { x: number; y: number; width: number; height: number }[]
    efficiency: number
    freeRects: { x: number; y: number; width: number; height: number }[]
    usedRects: { x: number; y: number; width: number; height: number }[]
}

interface SavedConfig {
    name: string
    sheetWidth: number
    sheetLength: number
    bladeWidth: number
    sheetPrice: number
    panels: Panel[]
}

export function CalculateSheets() {
    const [sheetWidth, setSheetWidth] = useState(1220)
    const [sheetLength, setSheetLength] = useState(2440)
    const [bladeWidth, setBladeWidth] = useState(3)
    const [sheetPrice, setSheetPrice] = useState(60)
    const [panels, setPanels] = useState<Panel[]>([{ width: 600, length: 400, quantity: 1 }])
    const [calculatedSheets, setCalculatedSheets] = useState<Sheet[]>([])
    const [savedConfigs, setSavedConfigs] = useState<SavedConfig[]>([])
    const [currentConfig, setCurrentConfig] = useState<string | null>(null)
    const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([])
    const printRef = useRef<HTMLDivElement>(null)

    // Load saved configurations and set first one as current on mount
    useEffect(() => {
        const saved = localStorage.getItem("cutlConfigs")
        if (saved) {
            const configs = JSON.parse(saved)
            setSavedConfigs(configs)

            // Load the last config if it exists
            if (configs.length > 0) {
                const lastConfig = configs[configs.length - 1]
                loadConfiguration(lastConfig)
                setCurrentConfig(lastConfig.name)
            }
        }
    }, [])

    const containerRef = useRef<HTMLDivElement>(null);
    const prevBoardsRef = useRef<any[]>([]);
    // Generate a unique color for each distinct rectangle size
    const getColorForSize = useMemo(() => {
        const colorMap = new Map();
        const generateColor = () => `hsl(${Math.random() * 360}, 70%, 60%)`;
        return (width: number, height: number) => {
            const key = `${width}x${height}`;
            if (!colorMap.has(key)) {
                colorMap.set(key, generateColor());
            }
            return colorMap.get(key);
        };
    }, []);

    const drawSheets = () => {
        console.log('Starting drawSheets with:', {
            calculatedSheets,
            sheetWidth,
            sheetLength,
            canvasRefs: canvasRefs.current
        });

        calculatedSheets.forEach((board, index) => {
            console.log('Drawing board:', index, board);
            const canvas = canvasRefs.current[index];
            console.log('Canvas:', canvas);

            if (!canvas) {
                console.log('No canvas found for index:', index);
                return;
            }

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                console.log('No context found for canvas:', index);
                return;
            }

            const scaleFactor = 550 / sheetLength;
            canvas.width = sheetLength * scaleFactor;
            canvas.height = sheetWidth * scaleFactor;
            canvas.style.border = '1px solid #ccc';

            console.log('Canvas dimensions:', canvas.width, canvas.height);
            console.log('Board used rects:', board.usedRects);
            console.log('Board free rects:', board.freeRects);

            ctx.fillStyle = '#f8f9fa';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw panels first
            board.usedRects.forEach((rect: any) => {
                console.log('Drawing rect:', rect);
                const x = rect.y * scaleFactor;
                const y = rect.x * scaleFactor;
                const width = rect.length * scaleFactor;
                const height = rect.width * scaleFactor;

                console.log('Drawing rect:', x, y, width, height);

                ctx.fillStyle = getColorForSize(rect.width, rect.length);
                ctx.fillRect(x, y, width, height);

                ctx.strokeStyle = '#000';
                ctx.lineWidth = 1;
                ctx.strokeRect(x, y, width, height);

                // Adjust font size to fit inside small panels
                const fontSize = Math.min(48 * scaleFactor, width * 0.3, height * 0.3);
                ctx.font = `${fontSize}px Arial`;
                ctx.fillStyle = '#000';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                // Place height text in the center
                ctx.fillText(`${rect.length}`, x + width / 2, y + fontSize);

                // Rotate and place width text
                ctx.save();
                ctx.translate(x + fontSize, y + height / 2);
                ctx.rotate(-Math.PI / 2);
                ctx.fillText(`${rect.width}`, 0, 0);
                ctx.restore();
            });

            // Draw free spaces
            board.freeRects.forEach((rect: any) => {
                const x = rect.y * scaleFactor;
                const y = rect.x * scaleFactor;
                const width = rect.length * scaleFactor;
                const height = rect.width * scaleFactor;

                ctx.fillStyle = 'rgba(200, 200, 200, 0.5)'; // Light gray for free spaces
                ctx.fillRect(x, y, width, height);

                ctx.strokeStyle = '#999';
                ctx.lineWidth = 1;
                ctx.strokeRect(x, y, width, height);

                // Adjust font size for free space labels
                const fontSize = Math.min(48 * scaleFactor, width * 0.3, height * 0.3);
                ctx.font = `${fontSize}px Arial`;
                ctx.fillStyle = '#555';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                // Ensure text is inside the free space
                ctx.fillText(`${rect.length}`, x + width / 2, y + fontSize);

                // Rotate and place width text
                ctx.save();
                ctx.translate(x + fontSize, y + height / 2);
                ctx.rotate(-Math.PI / 2);
                ctx.fillText(`${rect.width}`, 0, 0);
                ctx.restore();
            });
        });
    };

    useEffect(() => {
        if (!calculatedSheets || calculatedSheets.length === 0) return;

        if (calculatedSheets.length > 0) {
            console.log("Drawing sheets:", calculatedSheets);  // Debug log
        }

        // Prevent unnecessary re-renders
        if (JSON.stringify(calculatedSheets) === JSON.stringify(prevBoardsRef.current)) {
            return;
        }
        prevBoardsRef.current = calculatedSheets; // Store previous boards

        drawSheets();
    }, [calculatedSheets, sheetWidth, sheetLength]);

    const addPanel = () => {
        setPanels([...panels, { width: 0, length: 0, quantity: 1 }])
    }

    const duplicatePanel = (index: number) => {
        const panelToDuplicate = panels[index]
        setPanels([...panels, { ...panelToDuplicate }])
    }

    const removePanel = (index: number) => {
        setPanels(panels.filter((_, i) => i !== index))
    }

    const updatePanel = (index: number, field: keyof Panel, value: number) => {
        const newPanels = [...panels]
        newPanels[index] = { ...newPanels[index], [field]: value }
        setPanels(newPanels)
    }

    const calculateCuts = async () => {
        console.log("Calculating cuts...")

        const flatPanels = panels.flatMap(item =>
            Array(item.quantity).fill({
                width: item.width,
                length: item.length
            })
        );
        const boards = await calculateCutsAction(flatPanels, sheetWidth, sheetLength, bladeWidth);
        console.log(boards)

        if (boards) {
            setCalculatedSheets(boards);
        }
    }

    const saveConfiguration = () => {
        if (currentConfig) {
            // Update existing configuration
            const updatedConfigs = savedConfigs.map(config =>
                config.name === currentConfig
                    ? {
                        name: config.name,
                        sheetWidth,
                        sheetLength,
                        bladeWidth,
                        sheetPrice,
                        panels,
                    }
                    : config
            )
            setSavedConfigs(updatedConfigs)
            localStorage.setItem("cutlConfigs", JSON.stringify(updatedConfigs))
            toast({
                title: "Configuration updated",
                description: `Updated "${currentConfig}"`,
            })
        } else {
            // Create new configuration
            const name = prompt("Enter a name for this configuration:")
            if (!name) return

            const newConfig: SavedConfig = {
                name,
                sheetWidth,
                sheetLength,
                bladeWidth,
                sheetPrice,
                panels,
            }

            const updatedConfigs = [...savedConfigs, newConfig]
            setSavedConfigs(updatedConfigs)
            localStorage.setItem("cutlConfigs", JSON.stringify(updatedConfigs))
            setCurrentConfig(name)
            toast({
                title: "Configuration saved",
                description: `Saved as "${name}"`,
            })
        }
    }

    const loadConfiguration = (config: SavedConfig) => {
        setSheetWidth(config.sheetWidth)
        setSheetLength(config.sheetLength)
        setBladeWidth(config.bladeWidth)
        setSheetPrice(config.sheetPrice)
        setPanels(config.panels)
        setCurrentConfig(config.name)
        toast({
            title: "Configuration loaded",
            description: `Loaded "${config.name}"`,
        })
    }

    const exportCuttingPlan = () => {
        const doc = new jsPDF({
            orientation: 'landscape', // Keep the PDF in landscape mode
            unit: 'mm',
            format: 'a4'
        });
    
        const pageWidth = doc.internal.pageSize.getWidth(); // A4 landscape width (297mm)
        const pageHeight = doc.internal.pageSize.getHeight(); // A4 landscape height (210mm)
        const margin = 15; // Standard margin
    
        calculatedSheets.forEach((board, index) => {
            if (index > 0) {
                doc.addPage();
            }
    
            // Title & Sheet Info
            doc.setFontSize(18);
            doc.text(`Sheet ${index + 1}`, margin, margin);
    
            doc.setFontSize(12);
            doc.text([
                `Dimensions: ${sheetWidth}mm × ${sheetLength}mm`,
                `Efficiency: ${(board.efficiency * 100).toFixed(1)}%`
            ], margin, margin + 10);
    
            // Cut List Table
            const tableStartY = margin + 20;
            (doc as any).autoTable({
                startY: tableStartY,
                head: [['Piece', 'Width', 'Length', 'Position']],
                body: board.usedRects.map((rect, i) => [
                    i + 1,
                    `${rect.width}mm`,
                    `${rect.length}mm`,
                    `(${rect.x}mm, ${rect.y}mm)`
                ]),
                theme: 'grid',
                headStyles: { fillColor: [75, 75, 75] },
                margin: { left: margin, right: margin }
            });
    
            const tableEndY = (doc as any).autoTable.previous.finalY;
            const availableHeight = pageHeight - tableEndY - margin * 2; // Space for image
            const availableWidth = pageWidth - margin * 2; // Full width minus margins
    
            // 📌 **Ensure correct aspect ratio**
            const scaleX = availableWidth / sheetLength;
            const scaleY = availableHeight / sheetWidth;
            const scaleFactor = Math.min(scaleX, scaleY) * 0.98; // Maximize size
    
            // 🛠 **Fit the entire board inside the available space**
            const imageWidth = sheetLength * scaleFactor;
            const imageHeight = sheetWidth * scaleFactor;
            const imageX = margin + (availableWidth - imageWidth) / 2; // Center horizontally
            const imageY = tableEndY + 10; // Place below table
    
            // 🎨 **Create High-Resolution Canvas**
            const pdfCanvas = document.createElement('canvas');
            const ctx = pdfCanvas.getContext('2d');
            if (ctx) {
                // 📌 **Increase Resolution for Crisp Text**
                const highResScale = 4; // Even sharper text
                pdfCanvas.width = sheetLength * scaleFactor * highResScale;
                pdfCanvas.height = sheetWidth * scaleFactor * highResScale;
                ctx.scale(scaleFactor * highResScale, scaleFactor * highResScale);
    
                // 🟫 **Draw the Board Background**
                ctx.fillStyle = '#cccccc'; // Light gray background
                ctx.fillRect(0, 0, sheetLength, sheetWidth);
    
                // 🔄 **Ensure the correct horizontal layout**
                ctx.translate(sheetLength, 0); // Move to correct position
                ctx.rotate(Math.PI / 2); // Rotate correctly
    
                // 🔲 **Draw Free Rectangles (Unused Spaces)**
                board.freeRects.forEach((rect) => {
                    ctx.fillStyle = 'rgba(200, 200, 200, 0.5)'; // Semi-transparent gray
                    ctx.strokeStyle = '#999'; // Light gray border
                    ctx.lineWidth = 1;
    
                    ctx.fillRect(rect.x, rect.y, rect.width, rect.length);
                    ctx.strokeRect(rect.x, rect.y, rect.width, rect.length);
    
                    // 🔠 **Label Free Spaces Correctly**
                    const fontSize = Math.max(22, Math.min(30, rect.width * 0.15)); // Bigger for readability
                    ctx.fillStyle = '#000000';
                    ctx.font = `bold ${fontSize}px Arial`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
    
                    // 🖍 **Fix White Outline Rotation**
                    ctx.save();
                    ctx.translate(rect.x + rect.width / 2, rect.y + fontSize + 2);
    
                    ctx.strokeStyle = '#FFFFFF';
                    ctx.lineWidth = 8;
                    ctx.strokeText(`${rect.width}`, 0, 0);
                    ctx.fillStyle = '#000000';
                    ctx.fillText(`${rect.width}`, 0, 0);
                    
                    ctx.restore();
    
                    ctx.save();
                    ctx.translate(rect.x + fontSize + 2, rect.y + rect.length / 2);
                    ctx.rotate(-Math.PI / 2);
    
                    ctx.strokeStyle = '#FFFFFF';
                    ctx.lineWidth = 8;
                    ctx.strokeText(`${rect.length}`, 0, 0);
                    ctx.fillStyle = '#000000';
                    ctx.fillText(`${rect.length}`, 0, 0);
                    
                    ctx.restore();
                });
    
                // ✂️ **Draw Cut Pieces Correctly**
                board.usedRects.forEach((rect, i) => {
                    ctx.fillStyle = `hsla(${(i * 37) % 360}, 70%, 70%, 0.8)`;
                    ctx.strokeStyle = '#000000';
                    ctx.lineWidth = 2;
    
                    ctx.fillRect(rect.x, rect.y, rect.width, rect.length);
                    ctx.strokeRect(rect.x, rect.y, rect.width, rect.length);
    
                    // 🔠 **Fix Dimension Text Positioning**
                    const fontSize = Math.max(26, Math.min(34, rect.width * 0.2));
                    ctx.font = `bold ${fontSize}px Arial`;
                    ctx.fillStyle = '#000000';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
    
                    // 🖍 **Fix White Outline Rotation for Cut Pieces**
                    ctx.save();
                    ctx.translate(rect.x + rect.width / 2, rect.y + fontSize + 2);
    
                    ctx.strokeStyle = '#FFFFFF';
                    ctx.lineWidth = 8;
                    ctx.strokeText(`${rect.width}`, 0, 0);
                    ctx.fillStyle = '#000000';
                    ctx.fillText(`${rect.width}`, 0, 0);
                    
                    ctx.restore();
    
                    ctx.save();
                    ctx.translate(rect.x + fontSize + 2, rect.y + rect.length / 2);
                    ctx.rotate(-Math.PI / 2);
    
                    ctx.strokeStyle = '#FFFFFF';
                    ctx.lineWidth = 8;
                    ctx.strokeText(`${rect.length}`, 0, 0);
                    ctx.fillStyle = '#000000';
                    ctx.fillText(`${rect.length}`, 0, 0);
                    
                    ctx.restore();
                });
    
                // 📸 **Convert to High-Quality PNG & Add to PDF**
                const imgData = pdfCanvas.toDataURL('image/png');
                doc.addImage(imgData, 'PNG', imageX, imageY, imageWidth, imageHeight);
            }
        });
    
        // 📂 **Save the final PDF**
        doc.save('cutting-plan.pdf');
    };
    

    const totalCost = calculatedSheets.length * sheetPrice
    const averageEfficiency = calculatedSheets.length
        ? calculatedSheets.reduce((acc, sheet) => acc + sheet.efficiency, 0) / calculatedSheets.length
        : 0

    // Add delete configuration function
    const deleteConfiguration = (configName: string) => {
        const updatedConfigs = savedConfigs.filter(config => config.name !== configName)
        setSavedConfigs(updatedConfigs)
        localStorage.setItem("cutlConfigs", JSON.stringify(updatedConfigs))

        // If we deleted the current config, load the last remaining one or clear
        if (currentConfig === configName) {
            if (updatedConfigs.length > 0) {
                const lastConfig = updatedConfigs[updatedConfigs.length - 1]
                loadConfiguration(lastConfig)
                setCurrentConfig(lastConfig.name)
            } else {
                setCurrentConfig(null)
                // Reset to defaults
                setSheetWidth(1220)
                setSheetLength(2440)
                setBladeWidth(3)
                setSheetPrice(60)
                setPanels([{ width: 600, length: 400, quantity: 1 }])
            }
        }

        toast({
            title: "Configuration deleted",
            description: `Deleted "${configName}"`,
        })
    }

    return (
        <div className="flex min-h-screen">
            {/* Settings Panel */}
            <div className="w-[400px] border-r p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <h2 className="text-md font-semibold">Sheet Settings</h2>
                        {currentConfig && (
                            <p className="text-sm text-muted-foreground">
                                Current: {currentConfig}
                            </p>
                        )}
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                                <Upload className="w-4 h-4 mr-1" />
                                Load
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            {savedConfigs.map((config) => (
                                <div key={config.name} className="flex items-center justify-between px-2 py-1 hover:bg-accent">
                                    <DropdownMenuItem
                                        onClick={() => loadConfiguration(config)}
                                        className={currentConfig === config.name ? "bg-accent flex-1" : "flex-1"}
                                    >
                                        {config.name}
                                    </DropdownMenuItem>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            if (confirm(`Are you sure you want to delete "${config.name}"?`)) {
                                                deleteConfiguration(config.name)
                                            }
                                        }}
                                        className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                <div className="space-y-4">
                    <div className="grid gap-2">
                        <Label htmlFor="sheet-width">Sheet Width (mm)</Label>
                        <Input
                            id="sheet-width"
                            type="number"
                            value={sheetWidth}
                            className="w-full"
                            onChange={(e) => setSheetWidth(Number(e.target.value))}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="sheet-length">Sheet Length (mm)</Label>
                        <Input
                            id="sheet-length"
                            type="number"
                            value={sheetLength}
                            onChange={(e) => setSheetLength(Number(e.target.value))}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="blade-width">Blade Width (mm)</Label>
                        <Input
                            id="blade-width"
                            type="number"
                            value={bladeWidth}
                            onChange={(e) => setBladeWidth(Number(e.target.value))}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="sheet-price">Sheet Price ($)</Label>
                        <Input
                            id="sheet-price"
                            type="number"
                            value={sheetPrice}
                            onChange={(e) => setSheetPrice(Number(e.target.value))}
                        />
                    </div>
                </div>

                <Separator />

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-md font-semibold">Panel Requirements</h2>
                        <Button variant="outline" size="sm" onClick={addPanel}>
                            <Plus className="w-4 h-4 mr-1" />
                            Add Panel
                        </Button>
                    </div>

                    <div className="space-y-2">
                        <div className="grid grid-cols-[1fr_1fr_1fr_auto_auto] gap-2 items-center text-sm font-medium text-muted-foreground">
                            <div>Width</div>
                            <div>Length</div>
                            <div>Qty</div>
                            <div></div>
                            <div></div>
                        </div>

                        {panels.map((panel, index) => (
                            <div key={index} className="grid grid-cols-[2fr_2fr_1fr_auto_auto] gap-2 items-center">
                                <Input
                                    type="number"
                                    value={panel.width}
                                    onChange={(e) => updatePanel(index, "width", Number(e.target.value))}
                                    className="h-8"
                                />
                                <Input
                                    type="number"
                                    value={panel.length}
                                    onChange={(e) => updatePanel(index, "length", Number(e.target.value))}
                                    className="h-8"
                                />
                                <Input
                                    type="number"
                                    value={panel.quantity}
                                    onChange={(e) => updatePanel(index, "quantity", Number(e.target.value))}
                                    className="h-8"
                                />
                                <Button variant="ghost" size="sm" onClick={() => duplicatePanel(index)} className="h-8 w-8 p-0">
                                    <Copy className="h-4 w-4" />
                                    <span className="sr-only">Duplicate panel {index + 1}</span>
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => removePanel(index)} className="h-8 w-8 p-0">
                                    <Trash2 className="h-4 w-4" />
                                    <span className="sr-only">Remove panel {index + 1}</span>
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex gap-2">
                    <Button className="flex-1" onClick={calculateCuts}>
                        Calculate Cuts
                    </Button>
                    <Button variant="outline" onClick={saveConfiguration}>
                        <Save className="w-4 h-4" />
                    </Button>
                </div>

                {calculatedSheets.length > 0 && (
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span>Total Sheets:</span>
                            <span>{calculatedSheets.length}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Total Cost:</span>
                            <span>${totalCost.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Average Efficiency:</span>
                            <span>{(averageEfficiency * 100).toFixed(1)}%</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Visualization Area */}
            <div className="flex-1 p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Cut Sheets</h2>
                    {calculatedSheets.length > 0 && (
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={exportCuttingPlan}>
                                <Download className="w-4 h-4 mr-2" />
                                Export Plan
                            </Button>
                        </div>
                    )}
                </div>

                {calculatedSheets.length > 0 && (
                    <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
                        <div className="text-sm">
                            <span className="text-muted-foreground">Total Sheets:</span>
                            <span className="font-medium ml-2">{calculatedSheets.length}</span>
                        </div>
                        <div className="text-sm">
                            <span className="text-muted-foreground">Total Cost:</span>
                            <span className="font-medium ml-2">${totalCost.toFixed(2)}</span>
                        </div>
                        <div className="text-sm">
                            <span className="text-muted-foreground">Average Efficiency:</span>
                            <span className="font-medium ml-2">{(averageEfficiency * 100).toFixed(1)}%</span>
                        </div>
                    </div>
                )}

                <div className="grid gap-6">
                    {calculatedSheets.map((sheet, sheetIndex) => (
                        <div key={sheetIndex} className="space-y-2 p-2">
                            <div className="flex items-center justify-between">
                                <h3 className="font-medium">Sheet {sheetIndex + 1}</h3>
                                <span className="text-sm text-muted-foreground">
                                    Efficiency: {(sheet.efficiency * 100).toFixed(1)}%
                                </span>
                            </div>
                            <canvas
                                ref={el => canvasRefs.current[sheetIndex] = el}
                                width={sheetWidth}
                                height={sheetLength}
                                className="border rounded-lg w-full max-w-[600px] h-auto"
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Hidden printable content */}
            <div ref={printRef} className="hidden">
                {calculatedSheets.map((board, index) => (
                    <div key={index} style={{ pageBreakAfter: 'always' }} className="p-4">
                        <div className="mb-4">
                            <h2 className="text-xl font-bold mb-2">Sheet {index + 1}</h2>
                            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                                <div>
                                    <span className="text-muted-foreground">Dimensions:</span>
                                    <span className="font-medium ml-2">{sheetWidth}mm × {sheetLength}mm</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground">Efficiency:</span>
                                    <span className="font-medium ml-2">{(board.efficiency * 100).toFixed(1)}%</span>
                                </div>
                            </div>
                        </div>

                        <div className="border rounded-lg p-4">
                            <h3 className="font-semibold mb-2">Cut List</h3>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left py-2">Piece</th>
                                        <th className="text-left py-2">Width</th>
                                        <th className="text-left py-2">Length</th>
                                        <th className="text-left py-2">Position (X, Y)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {board.usedRects.map((rect, rectIndex) => (
                                        <tr key={rectIndex} className="border-b last:border-0">
                                            <td className="py-2">{rectIndex + 1}</td>
                                            <td className="py-2">{rect.width}mm</td>
                                            <td className="py-2">{rect.width}mm</td>
                                            <td className="py-2">({rect.x}mm, {rect.y}mm)</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Summary for this sheet */}
                        <div className="mt-4 text-sm text-muted-foreground">
                            <div>Total pieces on this sheet: {board.usedRects.length}</div>
                            <div>Sheet cost: ${sheetPrice.toFixed(2)}</div>
                        </div>

                        {/* Add the canvas visualization */}
                        <div className="mt-6">
                            <h3 className="font-semibold mb-2">Visual Layout</h3>
                            <canvas
                                ref={el => {
                                    if (el) {
                                        const ctx = el.getContext('2d');
                                        if (ctx) {
                                            // Scale to fit A4 width while maintaining aspect ratio
                                            const a4Width = 210; // mm
                                            const scale = (a4Width - 40) / sheetWidth; // 40mm for margins
                                            
                                            el.width = sheetWidth * scale;
                                            el.height = sheetLength * scale;
                                            ctx.scale(scale, scale);
                                            
                                            // Use the same drawing logic as before
                                            ctx.fillStyle = '#ffffff';
                                            ctx.fillRect(0, 0, sheetWidth, sheetLength);
                                            
                                            // Draw grid, free rects, used rects as before...
                                            // ... (copy the drawing code from the main canvas)
                                        }
                                    }
                                }}
                                style={{
                                    width: '100%',
                                    height: 'auto',
                                    maxHeight: '60vh'
                                }}
                            />
                        </div>
                    </div>
                ))}

                {/* Final summary page */}
                <div style={{ pageBreakBefore: 'always' }} className="p-4">
                    <h2 className="text-xl font-bold mb-4">Cutting Plan Summary</h2>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-muted-foreground">Total Sheets:</span>
                                <span className="font-medium ml-2">{calculatedSheets.length}</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Total Cost:</span>
                                <span className="font-medium ml-2">${totalCost.toFixed(2)}</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Average Efficiency:</span>
                                <span className="font-medium ml-2">{(averageEfficiency * 100).toFixed(1)}%</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Sheet Dimensions:</span>
                                <span className="font-medium ml-2">{sheetWidth}mm × {sheetLength}mm</span>
                            </div>
                        </div>

                        <div className="border rounded-lg p-4 mt-4">
                            <h3 className="font-semibold mb-2">Required Panels</h3>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left py-2">Width</th>
                                        <th className="text-left py-2">Length</th>
                                        <th className="text-left py-2">Quantity</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {panels.map((panel, index) => (
                                        <tr key={index} className="border-b last:border-0">
                                            <td className="py-2">{panel.width}mm</td>
                                            <td className="py-2">{panel.length}mm</td>
                                            <td className="py-2">{panel.quantity}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

