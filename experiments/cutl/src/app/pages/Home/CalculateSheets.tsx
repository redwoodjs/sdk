"use client"

import { Download, Plus, Save, Trash2, Copy, Upload } from "lucide-react"
import { useState, useEffect } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { toast } from "@/components/ui/use-toast"

interface Panel {
    width: number
    height: number
    quantity: number
}

interface Sheet {
    cuts: { x: number; y: number; width: number; height: number }[]
    efficiency: number
}

interface SavedConfig {
    name: string
    sheetWidth: number
    sheetHeight: number
    bladeWidth: number
    sheetPrice: number
    panels: Panel[]
}

export function CalculateSheets() {
    const [sheetWidth, setSheetWidth] = useState(2440)
    const [sheetHeight, setSheetHeight] = useState(1220)
    const [bladeWidth, setBladeWidth] = useState(3)
    const [sheetPrice, setSheetPrice] = useState(60)
    const [panels, setPanels] = useState<Panel[]>([{ width: 600, height: 400, quantity: 1 }])
    const [calculatedSheets, setCalculatedSheets] = useState<Sheet[]>([])
    const [savedConfigs, setSavedConfigs] = useState<SavedConfig[]>([])

    // Load saved configurations on mount
    useEffect(() => {
        const saved = localStorage.getItem("cutlConfigs")
        if (saved) {
            setSavedConfigs(JSON.parse(saved))
        }
    }, [])

    const addPanel = () => {
        setPanels([...panels, { width: 0, height: 0, quantity: 1 }])
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

    const calculateCuts = () => {
        // This is a placeholder for the actual cutting algorithm
        setCalculatedSheets([
            {
                cuts: [
                    { x: 0, y: 0, width: 600, height: 400 },
                    { x: 600, y: 0, width: 600, height: 400 },
                    { x: 0, y: 400, width: 600, height: 400 },
                ],
                efficiency: 0.85,
            },
            {
                cuts: [
                    { x: 0, y: 0, width: 600, height: 400 },
                    { x: 600, y: 0, width: 600, height: 400 },
                ],
                efficiency: 0.65,
            },
        ])
    }

    const saveConfiguration = () => {
        const name = prompt("Enter a name for this configuration:")
        if (!name) return

        const newConfig: SavedConfig = {
            name,
            sheetWidth,
            sheetHeight,
            bladeWidth,
            sheetPrice,
            panels,
        }

        const updatedConfigs = [...savedConfigs, newConfig]
        setSavedConfigs(updatedConfigs)
        localStorage.setItem("cutlConfigs", JSON.stringify(updatedConfigs))
        toast({
            title: "Configuration saved",
            description: `Saved as "${name}"`,
        })
    }

    const loadConfiguration = (config: SavedConfig) => {
        setSheetWidth(config.sheetWidth)
        setSheetHeight(config.sheetHeight)
        setBladeWidth(config.bladeWidth)
        setSheetPrice(config.sheetPrice)
        setPanels(config.panels)
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
                height: sheetHeight,
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


    return (
        <div className="flex min-h-screen">
            {/* Settings Panel */}
            <div className="w-80 border-r p-6 space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Sheet Settings</h2>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                                <Upload className="w-4 h-4 mr-1" />
                                Load
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            {savedConfigs.map((config) => (
                                <DropdownMenuItem key={config.name} onClick={() => loadConfiguration(config)}>
                                    {config.name}
                                </DropdownMenuItem>
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
                            onChange={(e) => setSheetWidth(Number(e.target.value))}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="sheet-height">Sheet Height (mm)</Label>
                        <Input
                            id="sheet-height"
                            type="number"
                            value={sheetHeight}
                            onChange={(e) => setSheetHeight(Number(e.target.value))}
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
                        <h2 className="text-lg font-semibold">Panel Requirements</h2>
                        <Button variant="outline" size="sm" onClick={addPanel}>
                            <Plus className="w-4 h-4 mr-1" />
                            Add Panel
                        </Button>
                    </div>

                    <div className="space-y-2">
                        <div className="grid grid-cols-[1fr_1fr_1fr_auto_auto] gap-2 items-center text-sm font-medium text-muted-foreground">
                            <div>Width</div>
                            <div>Height</div>
                            <div>Qty</div>
                            <div></div>
                            <div></div>
                        </div>

                        {panels.map((panel, index) => (
                            <div key={index} className="grid grid-cols-[1fr_1fr_1fr_auto_auto] gap-2 items-center">
                                <Input
                                    type="number"
                                    value={panel.width}
                                    onChange={(e) => updatePanel(index, "width", Number(e.target.value))}
                                    className="h-8"
                                />
                                <Input
                                    type="number"
                                    value={panel.height}
                                    onChange={(e) => updatePanel(index, "height", Number(e.target.value))}
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
                        <div key={sheetIndex} className="space-y-2">
                            <div className="flex items-center justify-between">
                                <h3 className="font-medium">Sheet {sheetIndex + 1}</h3>
                                <span className="text-sm text-muted-foreground">
                                    Efficiency: {(sheet.efficiency * 100).toFixed(1)}%
                                </span>
                            </div>
                            <div
                                className="relative border rounded-lg"
                                style={{
                                    width: `${sheetWidth / 4}px`,
                                    height: `${sheetHeight / 4}px`,
                                }}
                            >
                                {sheet.cuts.map((cut, cutIndex) => (
                                    <div
                                        key={cutIndex}
                                        className="absolute bg-primary/20 border border-primary"
                                        style={{
                                            left: `${cut.x / 4}px`,
                                            top: `${cut.y / 4}px`,
                                            width: `${cut.width / 4}px`,
                                            height: `${cut.height / 4}px`,
                                        }}
                                    >
                                        <div className="absolute inset-0 flex items-center justify-center text-xs font-medium">
                                            {cut.width} x {cut.height}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

