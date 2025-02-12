"use client"

import { Download, Plus, Save, Trash2, Copy, Upload } from "lucide-react"
import { useState, useEffect, useRef, useMemo } from "react"

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
        const totalSheets = calculatedSheets.length
        const totalCost = totalSheets * sheetPrice
        const averageEfficiency = calculatedSheets.reduce((acc, sheet) => acc + sheet.efficiency, 0) / totalSheets

        const plan = {
            sheetSettings: {
                width: sheetWidth,
                length: sheetLength,
                bladeWidth,
                pricePerSheet: sheetPrice,
            },
            panels,
            results: {
                totalSheets,
                totalCost,
                averageEfficiency,
                sheets: calculatedSheets,
            },
        }

        const blob = new Blob([JSON.stringify(plan, null, 2)], { type: "application/json" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = "cutting-plan.json"
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
    }

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
            </div>

            {/* Visualization Area */}
            <div className="flex-1 p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Cut Sheets</h2>
                    {calculatedSheets.length > 0 && (
                        <Button variant="outline" onClick={exportCuttingPlan}>
                            <Download className="w-4 h-4 mr-2" />
                            Export Plan
                        </Button>
                    )}
                </div>

                {calculatedSheets.length > 0 && (
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                            <span className="font-medium">Total Sheets:</span>
                            <span>{calculatedSheets.length}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="font-medium">Total Cost:</span>
                            <span>${totalCost.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="font-medium">Average Efficiency:</span>
                            <span>{(averageEfficiency * 100).toFixed(1)}%</span>
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
        </div>
    )
}

