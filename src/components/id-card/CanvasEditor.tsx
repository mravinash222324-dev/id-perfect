
import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import * as fabric from 'fabric';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Type, Image as ImageIcon, RotateCw, Trash2, Layers, Move, Square, Circle, Eye, EyeOff, AlignLeft, AlignCenter, AlignRight, ChevronsUp, ChevronsDown, ChevronUp, ChevronDown, Maximize, ZoomIn, ZoomOut } from 'lucide-react';

export interface CanvasEditorRef {
    triggerSave: () => void;
}

interface CanvasEditorProps {
    initialData?: any;
    onSave: (data: any) => void;
    width?: number;
    height?: number;
}

export const CanvasEditor = forwardRef<CanvasEditorRef, CanvasEditorProps>(({ initialData, onSave, width = 1011, height = 638 }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [canvas, setCanvas] = useState<fabric.Canvas | null>(null);
    const [selectedObject, setSelectedObject] = useState<fabric.FabricObject | null>(null);
    const [isPreview, setIsPreview] = useState(false);
    const isPreviewRef = useRef(false);
    const [activeSide, setActiveSide] = useState<'front' | 'back'>('front');
    const activeSideRef = useRef(activeSide);
    const switchingSideRef = useRef(false);
    const [frontJson, setFrontJson] = useState<any>(null); // Store front design
    const [backJson, setBackJson] = useState<any>(null); // Store back design
    const [zoom, setZoom] = useState(1);

    useImperativeHandle(ref, () => ({
        triggerSave: () => {
            handleSave();
        }
    }));

    // Keep ref in sync
    useEffect(() => {
        activeSideRef.current = activeSide;
    }, [activeSide]);

    // Initialize Canvas
    useEffect(() => {
        if (!canvasRef.current) return;

        // console.log("Initializing CanvasEditor...");
        let isMounted = true;
        let activeCanvas: fabric.Canvas | null = null;
        let retryCount = 0;
        const maxRetries = 10;

        const initCanvas = async () => {
            if (!isMounted || !canvasRef.current) return;

            try {
                // Check if the DOM element is already wrapped by fabric (class 'lower-canvas')
                // This indicates a previous instance wasn't fully disposed yet.
                if (canvasRef.current.classList.contains('lower-canvas')) {
                    throw new Error("Canvas element is already initialized (DOM check)");
                }

                // Attempt synchronization creation
                const newCanvas = new fabric.Canvas(canvasRef.current, {
                    width: width,
                    height: height,
                    backgroundColor: '#ffffff',
                    selection: true
                });

                activeCanvas = newCanvas;
                setCanvas(newCanvas);

                // Load initial content
                if (initialData) {
                    try {
                        const json = initialData.front_design || initialData;

                        if (initialData.front_design) {
                            setFrontJson(initialData.front_design);
                            setBackJson(initialData.back_design);
                        } else {
                            setFrontJson(initialData);
                        }

                        if (json) {
                            await newCanvas.loadFromJSON(json);
                        }
                    } catch (err) {
                        console.error("Error loading initial canvas data:", err);
                    }
                    newCanvas.requestRenderAll();
                }

                // Attach Events
                newCanvas.on('selection:created', (e) => setSelectedObject(e.selected?.[0] || null));
                newCanvas.on('selection:updated', (e) => setSelectedObject(e.selected?.[0] || null));
                newCanvas.on('selection:cleared', () => setSelectedObject(null));

                newCanvas.on('object:modified', () => saveCurrentSide(newCanvas));
                newCanvas.on('object:added', () => saveCurrentSide(newCanvas));
                newCanvas.on('object:removed', () => saveCurrentSide(newCanvas));

            } catch (err: any) {
                console.warn(`Init attempt ${retryCount + 1} failed:`, err.message);

                if (retryCount < maxRetries && isMounted) {
                    retryCount++;
                    // Wait and retry
                    setTimeout(initCanvas, 50);
                } else {
                    console.error("Critical: Failed to initialize canvas after max retries.");
                }
            }
        };

        // Start initialization
        initCanvas();

        // Cleanup
        return () => {
            isMounted = false;
            // console.log("Disposing CanvasEditor...");

            // If we have an active instance, dispose it
            if (activeCanvas) {
                activeCanvas.dispose().then(() => {
                    // console.log("CanvasEditor disposed.");
                }).catch(e => console.error("Dispose error", e));
            }
            setCanvas(null);
        };
    }, []); // Run once on mount

    const saveCurrentSide = (c: fabric.Canvas) => {
        // Fix: Don't save if we are in the middle of switching sides OR in preview mode
        if (switchingSideRef.current || isPreviewRef.current) return;

        const json = c.toObject(['data', 'isPhotoPlaceholder', 'isPlaceholder', 'id', 'selectable', 'isCircle']);
        // Fix: Use ref to get current side inside event listeners (closure trap)
        if (activeSideRef.current === 'front') {
            setFrontJson(json);
        } else {
            setBackJson(json);
        }
    };

    // Switch Sides
    // Switch Sides
    const handleSideChange = async (side: 'front' | 'back') => {
        if (!canvas) return;

        // If NOT in preview, save state.
        // If in preview, we SKIP saving because it's dirty.
        if (!isPreviewRef.current) {
            saveCurrentSide(canvas);
        }

        // Lock auto-save
        switchingSideRef.current = true;

        // Load new
        const jsonToLoad = side === 'front' ? frontJson : backJson;

        canvas.clear();
        canvas.backgroundColor = '#ffffff'; // Reset bg

        if (jsonToLoad) {
            await canvas.loadFromJSON(jsonToLoad);
        }

        // If preview was active, re-apply it to the new side
        if (isPreviewRef.current) {
            await applyPreview(canvas);
        }

        canvas.renderAll();
        setActiveSide(side);
        setSelectedObject(null);

        // Unlock auto-save
        switchingSideRef.current = false;
    };


    const handleSave = () => {
        if (!canvas) return;
        // Ensure current side is up to date
        const currentJson = canvas.toObject(['data', 'isPhotoPlaceholder', 'isPlaceholder', 'id', 'selectable', 'isCircle']);

        const finalData = {
            front_design: activeSide === 'front' ? currentJson : frontJson,
            back_design: activeSide === 'back' ? currentJson : backJson
        };

        onSave(finalData);
    };

    // Helper to Apply Preview
    const applyPreview = async (c: fabric.Canvas) => {
        const dummyData: Record<string, string> = {
            name: 'John Doe',
            roll_number: 'STU-2024-001',
            class: '10th Grade',
            department: 'Computer Science',
            blood_group: 'B+',
            email: 'john.doe@school.edu',
            phone: '+1 (555) 123-4567',
            dob: '2008-05-15',
            address: '123 School Lane, Education City, ST 12345',
            guardian_name: 'Jane Doe',
            batch: '2024-2025'
        };

        const objects = c.getObjects();

        // 1. Text Replacement
        objects.forEach((obj: any) => {
            const isPlaceholder = (obj.type === 'i-text' && obj.text?.startsWith('{{') && obj.text?.endsWith('}}')) || obj.data?.key;
            if (isPlaceholder) {
                obj.originalText = obj.text;
                let key = obj.data?.key;
                if (!key && obj.text?.startsWith('{{')) {
                    key = obj.text.slice(2, -2).trim();
                }
                if (key) {
                    const replacement = dummyData[key] || `Sample ${key}`;
                    obj.set({ text: replacement, editable: false });
                }
            }
        });

        // 2. Photo Replacement
        const photoPlaceholder = objects.find((obj: any) => obj.data?.isPhotoPlaceholder || (obj as any).isPhotoPlaceholder);
        if (photoPlaceholder) {
            try {
                (photoPlaceholder as any).originalVisible = photoPlaceholder.visible;
                photoPlaceholder.set({ visible: false, evented: false });

                const imgUrl = 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix';
                const imgElement = await new Promise<HTMLImageElement>((resolve, reject) => {
                    const img = new Image();
                    img.crossOrigin = 'anonymous';
                    img.onload = () => resolve(img);
                    img.onerror = reject;
                    img.src = imgUrl;
                });

                const fabricImage = new fabric.Image(imgElement);

                const phWidth = photoPlaceholder.width! * photoPlaceholder.scaleX!;
                const phHeight = photoPlaceholder.height! * photoPlaceholder.scaleY!;
                const phLeft = photoPlaceholder.left!;
                const phTop = photoPlaceholder.top!;

                // Correction for group origin (Circle group is usually center/center, Rect group is top/left in original code)
                // But my new Circle Group is center/center. My original Rect Group was default (top/left).
                // Let's normalize calculations.

                let centerX, centerY;
                if (photoPlaceholder.originX === 'center') {
                    centerX = phLeft;
                    centerY = phTop;
                } else {
                    centerX = phLeft + (phWidth / 2);
                    centerY = phTop + (phHeight / 2);
                }

                const scaleX = phWidth / fabricImage.width!;
                const scaleY = phHeight / fabricImage.height!;
                const scale = Math.max(scaleX, scaleY);

                const isCircle = (photoPlaceholder as any).isCircle;
                let clipPath;

                if (isCircle) {
                    clipPath = new fabric.Circle({
                        radius: phWidth / 2 / scale, // radius in image coordinate space
                        originX: 'center',
                        originY: 'center',
                        left: 0,
                        top: 0
                    });
                } else {
                    clipPath = new fabric.Rect({
                        left: 0,
                        top: 0,
                        width: phWidth / scale,
                        height: phHeight / scale,
                        originX: 'center',
                        originY: 'center',
                    });
                }

                fabricImage.set({
                    left: centerX,
                    top: centerY,
                    originX: 'center',
                    originY: 'center',
                    scaleX: scale,
                    scaleY: scale,
                    clipPath: clipPath,
                    selectable: false,
                });

                c.add(fabricImage);
                (fabricImage as any).isPreviewImage = true;
                (fabricImage as any).associatedPlaceholder = photoPlaceholder;
            } catch (e) {
                console.error("Preview image load failed", e);
                if (photoPlaceholder) photoPlaceholder.set({ visible: true, evented: true });
            }
        }
        c.requestRenderAll();
    };

    // Helper to Restore Original
    const restoreOriginal = (c: fabric.Canvas) => {
        const objects = c.getObjects();
        // 1. Restore Text
        objects.forEach((obj: any) => {
            if (obj.originalText) {
                obj.set({ text: obj.originalText, editable: true });
                delete obj.originalText;
            }
        });

        // 2. Remove Dummy Photo
        const previewImages = objects.filter((obj: any) => obj.isPreviewImage);
        previewImages.forEach((img: any) => {
            if (img.associatedPlaceholder) {
                img.associatedPlaceholder.set({ visible: true, evented: true });
            }
            c.remove(img);
        });
        c.requestRenderAll();
    };

    // Toggle Preview Mode
    const togglePreview = async () => {
        if (!canvas) return;

        if (!isPreview) {
            // Enable Preview
            saveCurrentSide(canvas);
            isPreviewRef.current = true; // Lock saves
            await applyPreview(canvas);
            setIsPreview(true);
        } else {
            // Disable Preview
            restoreOriginal(canvas);
            isPreviewRef.current = false; // Unlock saves
            setIsPreview(false);
        }
    };

    // Update Dimensions
    useEffect(() => {
        if (canvas) {
            canvas.setWidth(width);
            canvas.setHeight(height);
            canvas.renderAll();
        }
    }, [canvas, width, height]);


    // Add Text
    const addText = () => {
        if (!canvas) return;
        const text = new fabric.IText('Double click to edit', {
            left: 100,
            top: 100,
            fontFamily: 'Arial',
            fontSize: 24,
            fill: '#000000',
        });
        canvas.add(text);
        canvas.setActiveObject(text);
    };

    // Add Placeholder
    const addPlaceholder = (key: string) => {
        if (!canvas) return;
        const text = new fabric.IText(`{{${key}}}`, {
            left: 100,
            top: 100,
            fontFamily: 'Arial',
            fontSize: 24,
            fill: '#000000',
            data: { isPlaceholder: true, key }, // Custom data
        });
        canvas.add(text);
        canvas.setActiveObject(text);
    };

    // Add Image Placeholder
    const addImagePlaceholder = () => {
        if (!canvas) return;
        const rect = new fabric.Rect({
            left: 50,
            top: 50,
            width: 150,
            height: 200,
            fill: '#f0f0f0',
            stroke: '#cccccc',
            strokeWidth: 2,
            data: { isPhotoPlaceholder: true }
        });

        const text = new fabric.Text('PHOTO', {
            left: 90,
            top: 140,
            fontSize: 20,
            fill: '#999999',
            selectable: false
        });

        const group = new fabric.Group([rect, text], {
            left: 50,
            top: 50,
        });
        // Tag the group so we know it's a photo placeholder
        (group as any).isPhotoPlaceholder = true;

        canvas.add(group);
        canvas.setActiveObject(group);
    };

    // Add Image from Upload
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!canvas || !e.target.files?.[0]) return;

        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (event) => {
            const imgObj = new Image();
            imgObj.src = event.target?.result as string;
            imgObj.onload = () => {
                const fabricImage = new fabric.Image(imgObj);
                fabricImage.set({
                    left: 100,
                    top: 100,
                });
                // Scale if too big
                if (fabricImage.width! > 300) {
                    fabricImage.scaleToWidth(300);
                }
                canvas.add(fabricImage);
                canvas.setActiveObject(fabricImage);
            };
        };
        reader.readAsDataURL(file);
    };

    // Add Circle Photo Placeholder
    const addCirclePhotoPlaceholder = () => {
        if (!canvas) return;

        const circle = new fabric.Circle({
            radius: 75, // Diameter 150
            fill: '#f0f0f0',
            stroke: '#cccccc',
            strokeWidth: 2,
            originX: 'center',
            originY: 'center'
        });

        const text = new fabric.Text('PHOTO', {
            fontSize: 20,
            fill: '#999999',
            originX: 'center',
            originY: 'center',
            selectable: false
        });

        const group = new fabric.Group([circle, text], {
            left: 100,
            top: 100,
            // Important: Use origin center for easier circle clipping calculations later
            originX: 'center',
            originY: 'center'
        });

        // Tag the group so we know it's a photo placeholder AND it's circular
        (group as any).isPhotoPlaceholder = true;
        (group as any).isCircle = true;

        canvas.add(group);
        canvas.setActiveObject(group);
    };

    // Add Shape
    const addShape = (type: 'rect' | 'circle') => {
        if (!canvas) return;
        let shape;
        if (type === 'rect') {
            shape = new fabric.Rect({
                left: 100,
                top: 100,
                width: 100,
                height: 100,
                fill: '#cccccc',
            });
        } else {
            shape = new fabric.Circle({
                left: 100,
                top: 100,
                radius: 50,
                fill: '#cccccc',
            });
        }
        canvas.add(shape);
        canvas.setActiveObject(shape);
    };

    // Delete Object
    const deleteSelected = () => {
        if (!canvas || !selectedObject) return;
        canvas.remove(selectedObject);
        canvas.discardActiveObject();
        canvas.renderAll();
        setSelectedObject(null);
    };

    // Update Object Property
    const updateProperty = (key: string, value: any) => {
        if (!canvas || !selectedObject) return;
        selectedObject.set(key as any, value);
        selectedObject.setCoords(); // Required for some updates
        canvas.requestRenderAll();
    };

    // Layer Management
    const handleLayer = (action: 'front' | 'back' | 'forward' | 'backward') => {
        if (!canvas || !selectedObject) return;

        switch (action) {
            case 'front':
                canvas.bringObjectToFront(selectedObject);
                break;
            case 'back':
                canvas.sendObjectToBack(selectedObject);
                break;
            case 'forward':
                canvas.bringObjectForward(selectedObject);
                break;
            case 'backward':
                canvas.sendObjectBackwards(selectedObject);
                break;
        }
        canvas.renderAll();
        saveCurrentSide(canvas);
    };


    // Alignment Logic
    const handleAlign = (alignment: string) => {
        if (!canvas || !selectedObject) return;

        // We need to shift the object position to keep it visually in the same place
        // when changing originX, otherwise it jumps.
        const center = selectedObject.getCenterPoint();

        selectedObject.set({
            textAlign: alignment,
            originX: alignment as any,
        });

        // Reset position based on new anchor
        // This is complex in Fabric, simplistic approach:
        // If center, adjust left to center.
        // If left, adjust left to left edge.
        // Easier: Just set textual alignment property?
        // NO, the user wants "stable" alignment. 
        // If I set originX='center', increasing text length expands both ways. Correct.
        // But simply setting originX jumps the object.
        // So we just set it, and let user move it to correct spot? 
        // User asked "how to fix", implying they want it to work automatically.
        // Let's try just setting originX and let them reposition if needed, 
        // OR try to compensate. 
        // Basic compensation: 
        selectedObject.setPositionByOrigin(center, 'center', 'center');
        // Wait, if originX becomes 'left', setPositionByOrigin(center, 'left', 'center')?
        // No, we want the visual center to stay same? Or visual anchor?
        // Actually, best flow: User clicks "Center Align", text jumps to anchor at center.
        // User drags it to middle of card.
        // Then subsequent text changes expand from center.
        // So just setting properties is enough for the "Mechanism", user does "Placement".

        selectedObject.setCoords();
        canvas.requestRenderAll();
        updateProperty('textAlign', alignment);
        updateProperty('textAlign', alignment);
    };

    // Fit to Canvas
    const fitToCanvas = () => {
        if (!canvas || !selectedObject) return;
        const cw = canvas.width || 0;
        const ch = canvas.height || 0;

        // Reset scale first to get accurate calculation? 
        // No, use width/height * scaleX/scaleY generally, but raw width/height is better basis

        // Covering logic (like object-fit: cover)
        // scale = max(targetW/objW, targetH/objH)

        const objW = selectedObject.width || 0;
        const objH = selectedObject.height || 0;

        if (objW === 0 || objH === 0) return;

        const scaleX = cw / objW;
        const scaleY = ch / objH;

        // Use max to cover, min to contain. Usually "background" implies cover.
        const scale = Math.max(scaleX, scaleY);

        selectedObject.set({
            scaleX: scale,
            scaleY: scale,
            left: cw / 2,
            top: ch / 2,
            originX: 'center',
            originY: 'center'
        });

        selectedObject.setCoords();
        canvas.requestRenderAll();
    };

    const containerRef = useRef<HTMLDivElement>(null);

    // Auto-Fit Canvas on Mount
    useEffect(() => {
        const fitCanvas = () => {
            if (!containerRef.current) return;
            const container = containerRef.current;

            // Available space (subtracting padding p-8 = 32px*2 = 64px, plus some buffer)
            const padding = 80;
            const availableW = container.clientWidth - padding;
            const availableH = container.clientHeight - padding - 50; // Extra buffer for Tabs

            if (availableW <= 0 || availableH <= 0) return;

            const scaleX = availableW / width;
            const scaleY = availableH / height;

            // Fit to whichever is smaller constraint
            let newZoom = Math.min(scaleX, scaleY);

            // Cap initial zoom to reasonable limits (e.g. don't zoom in to 500% on tiny cards)
            newZoom = Math.min(Math.max(newZoom, 0.1), 1.0);

            setZoom(newZoom);
        };

        // Initial fit with small delay for layout paint
        const timeout = setTimeout(fitCanvas, 50);
        window.addEventListener('resize', fitCanvas);

        return () => {
            clearTimeout(timeout);
            window.removeEventListener('resize', fitCanvas);
        };
    }, [width, height]); // Re-run if card dimensions change

    return (
        <div className="flex bg-background border rounded-lg overflow-hidden h-full">
            {/* Sidebar - Tools */}
            <div className="w-64 bg-muted/30 border-r p-4 flex flex-col gap-4 overflow-y-auto">

                {/* Preview Toggle */}
                <div className="pb-4 border-b">
                    <Button
                        className={`w-full ${isPreview ? 'bg-orange-500 hover:bg-orange-600' : 'bg-slate-800 hover:bg-slate-900'} text-white`}
                        onClick={togglePreview}
                    >
                        {isPreview ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                        {isPreview ? 'Exit Preview' : 'Live Preview'}
                    </Button>
                    {isPreview && <p className="text-[10px] text-muted-foreground text-center mt-2">Editing locked in preview</p>}
                </div>

                <div className={`space-y-4 ${isPreview ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div className="space-y-2">
                        <Label className="text-xs uppercase text-muted-foreground font-bold">Add Elements</Label>
                        <div className="grid grid-cols-2 gap-2">
                            <Button variant="outline" size="sm" onClick={addText} className="justify-start">
                                <Type className="w-4 h-4 mr-2" /> Text
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-xs uppercase text-muted-foreground font-bold">Media</Label>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="relative">
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageUpload}
                                    className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full h-full"
                                />
                                <Button variant="outline" size="sm" className="w-full justify-start">
                                    <ImageIcon className="w-4 h-4 mr-2" /> Image
                                </Button>
                            </div>
                            <Button variant="outline" size="sm" onClick={addImagePlaceholder} className="justify-start">
                                <ImageIcon className="w-4 h-4 mr-2" /> Rect Photo
                            </Button>
                            <Button variant="outline" size="sm" onClick={addCirclePhotoPlaceholder} className="justify-start">
                                <Circle className="w-4 h-4 mr-2" /> Circle Photo
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-xs uppercase text-muted-foreground font-bold">Shapes</Label>
                        <div className="grid grid-cols-2 gap-2">
                            <Button variant="outline" size="sm" onClick={() => addShape('rect')} className="justify-start">
                                <Square className="w-4 h-4 mr-2" /> Rect
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => addShape('circle')} className="justify-start">
                                <Circle className="w-4 h-4 mr-2" /> Circle
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label className="text-xs uppercase text-muted-foreground font-bold">Data Fields</Label>
                        <div className="grid grid-cols-2 gap-2">
                            {['name', 'roll_number', 'class', 'department', 'blood_group', 'email', 'phone', 'dob', 'address', 'guardian_name', 'batch'].map(field => (
                                <Button key={field} variant="outline" size="sm" onClick={() => addPlaceholder(field)} className="justify-start font-mono text-[10px] h-8 truncate bg-card/50 hover:bg-primary/20 hover:text-primary hover:border-primary/50 transition-all" title={field}>
                                    {`{{${field}}}`}
                                </Button>
                            ))}
                        </div>
                        <div className="flex gap-2 mt-2">
                            <Input
                                placeholder="custom_field"
                                className="h-8 text-xs font-mono"
                                id="custom-field-input"
                            />
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-2"
                                onClick={() => {
                                    const input = document.getElementById('custom-field-input') as HTMLInputElement;
                                    if (input && input.value) {
                                        addPlaceholder(input.value);
                                        input.value = '';
                                    }
                                }}
                            >
                                Add
                            </Button>
                        </div>
                    </div>

                    <div className="mt-auto">
                        <Button className="w-full gradient-primary" onClick={handleSave}>Save Template</Button>
                    </div>
                </div>
            </div>

            {/* Main Canvas Area */}
            <div className="flex-1 bg-gray-100 relative flex flex-col min-w-0 overflow-hidden">
                {/* Scrollable Container */}
                <div ref={containerRef} className="flex-1 overflow-auto p-8 flex">
                    <div className="m-auto flex flex-col items-center">
                        <div className="mb-4">
                            <Tabs value={activeSide} onValueChange={(v) => handleSideChange(v as 'front' | 'back')}>
                                <TabsList className="glass p-1">
                                    <TabsTrigger value="front" className="w-24 data-[state=active]:bg-primary data-[state=active]:text-white">Front Side</TabsTrigger>
                                    <TabsTrigger value="back" className="w-24 data-[state=active]:bg-primary data-[state=active]:text-white">Back Side</TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>
                        <div
                            className="shadow-2xl relative transition-all duration-200 ease-out"
                            style={{
                                width: width * zoom,
                                height: height * zoom
                            }}
                        >
                            <div className="origin-top-left" style={{ transform: `scale(${zoom})` }}>
                                <canvas ref={canvasRef} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Zoom Controls Overlay - Fixed outside scroll flow */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 glass px-4 py-2 flex items-center gap-4 z-10 rounded-full border-white/10">
                    <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={() => setZoom(z => Math.max(0.2, z - 0.1))}>
                        <ZoomOut className="w-3 h-3" />
                    </Button>
                    <span className="text-xs font-medium w-12 text-center">{Math.round(zoom * 100)}%</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={() => setZoom(z => Math.min(2, z + 0.1))}>
                        <ZoomIn className="w-3 h-3" />
                    </Button>
                    <div className="w-px h-4 bg-border mx-1" />
                    <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setZoom(1)}>Reset</Button>
                    <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setZoom(0.5)}>Fit</Button>
                </div>
            </div>

            {/* Right Sidebar - Properties */}
            <div className="w-72 bg-muted/30 border-l p-4 overflow-y-auto">
                {selectedObject ? (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-sm">Properties</h3>
                            <Button variant="ghost" size="icon" onClick={deleteSelected} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Color</Label>
                                <div className="flex gap-2">
                                    <Input
                                        type="color"
                                        value={selectedObject.fill as string}
                                        onChange={(e) => updateProperty('fill', e.target.value)}
                                        className="w-12 h-8 p-1 cursor-pointer"
                                    />
                                    <Input
                                        value={selectedObject.fill as string}
                                        onChange={(e) => updateProperty('fill', e.target.value)}
                                        className="flex-1 font-mono text-xs"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Opacity</Label>
                                <Slider
                                    value={[(selectedObject.opacity || 1) * 100]}
                                    max={100}
                                    step={1}
                                    onValueChange={(vals) => updateProperty('opacity', vals[0] / 100)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Layer Order</Label>
                                <div className="flex gap-1">
                                    <Button variant="outline" size="sm" className="flex-1" onClick={() => handleLayer('front')} title="Bring to Front">
                                        <ChevronsUp className="h-4 w-4" />
                                    </Button>
                                    <Button variant="outline" size="sm" className="flex-1" onClick={() => handleLayer('forward')} title="Bring Forward">
                                        <ChevronUp className="h-4 w-4" />
                                    </Button>
                                    <Button variant="outline" size="sm" className="flex-1" onClick={() => handleLayer('backward')} title="Send Backward">
                                        <ChevronDown className="h-4 w-4" />
                                    </Button>
                                    <Button variant="outline" size="sm" className="flex-1" onClick={() => handleLayer('back')} title="Send to Back">
                                        <ChevronsDown className="h-4 w-4" />
                                    </Button>
                                </div>
                                {(selectedObject.type === 'image' || selectedObject.type === 'rect') && (
                                    <Button variant="secondary" size="sm" className="w-full mt-2" onClick={fitToCanvas}>
                                        <Maximize className="w-4 h-4 mr-2" /> Fit to Canvas
                                    </Button>
                                )}
                            </div>


                            {/* Text Specific Properties */}
                            {(selectedObject instanceof fabric.IText || selectedObject.type === 'i-text') && (
                                <>
                                    <div className="space-y-2">
                                        <Label>Font Size</Label>
                                        <Input
                                            type="number"
                                            value={(selectedObject as fabric.IText).fontSize}
                                            onChange={(e) => updateProperty('fontSize', parseInt(e.target.value))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Font Family</Label>
                                        <select
                                            className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                                            value={(selectedObject as fabric.IText).fontFamily}
                                            onChange={(e) => updateProperty('fontFamily', e.target.value)}
                                        >
                                            <option value="Arial">Arial</option>
                                            <option value="Times New Roman">Times New Roman</option>
                                            <option value="Courier New">Courier New</option>
                                            <option value="Verdana">Verdana</option>
                                            <option value="Roboto">Roboto</option>
                                            <option value="Open Sans">Open Sans</option>
                                            <option value="Montserrat">Montserrat</option>
                                            <option value="Lato">Lato</option>
                                            <option value="Poppins">Poppins</option>
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Alignment</Label>
                                        <div className="flex gap-1">
                                            <Button
                                                variant={(selectedObject as fabric.IText).textAlign === 'left' ? 'secondary' : 'outline'}
                                                size="sm"
                                                className="flex-1"
                                                onClick={() => handleAlign('left')}
                                            >
                                                <AlignLeft className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant={(selectedObject as fabric.IText).textAlign === 'center' ? 'secondary' : 'outline'}
                                                size="sm"
                                                className="flex-1"
                                                onClick={() => handleAlign('center')}
                                            >
                                                <AlignCenter className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant={(selectedObject as fabric.IText).textAlign === 'right' ? 'secondary' : 'outline'}
                                                size="sm"
                                                className="flex-1"
                                                onClick={() => handleAlign('right')}
                                            >
                                                <AlignRight className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>

                                </>
                            )}

                        </div>
                    </div>
                ) : (
                    <div className="text-center text-muted-foreground mt-10">
                        <Move className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Select an element to edit properties</p>
                    </div>
                )}
            </div>
        </div >
    );
});
