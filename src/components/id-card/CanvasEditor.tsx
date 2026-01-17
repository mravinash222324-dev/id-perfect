
import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import * as fabric from 'fabric';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Type, Image as ImageIcon, RotateCw, Trash2, Layers, Move, Square, Circle, Eye, EyeOff, AlignLeft, AlignCenter, AlignRight, ChevronsUp, ChevronsDown, ChevronUp, ChevronDown, Maximize, ZoomIn, ZoomOut, Plus, Lock, Unlock } from 'lucide-react';


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

    const [layers, setLayers] = useState<fabric.FabricObject[]>([]);
    const [activeLeftTab, setActiveLeftTab] = useState('assets');

    // Update Layers List
    const updateLayers = (c: fabric.Canvas) => {
        if (!c) return;
        // Get all objects, reverse them so top layer is first in list
        const objs = c.getObjects().slice().reverse();
        setLayers(objs);
    };

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

                // Use saveHistory instead of saveCurrentSide for undo/redo
                newCanvas.on('object:modified', () => { saveHistory(newCanvas); updateLayers(newCanvas); });
                newCanvas.on('object:added', () => { saveHistory(newCanvas); updateLayers(newCanvas); });
                newCanvas.on('object:removed', () => { saveHistory(newCanvas); updateLayers(newCanvas); });

                // Also update on layout changes that might not trigger history but affect layers (e.g. z-index)
                // Actually object:modified covers most, but we can call it manually on handleLayer

                // Initial history save & layer update
                saveHistory(newCanvas);
                updateLayers(newCanvas);

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
    }, []); // Run once on mount (removing history dependency to avoid loops, history functions use ref if needed or are stable)

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

    // Force re-render helper
    const [, forceUpdate] = useState(0);

    // Update Object Property
    const updateProperty = (key: string, value: any) => {
        if (!canvas || !selectedObject) return;
        selectedObject.set(key as any, value);

        // Special handling for some properties that require deep updates
        if (key === 'fill') {
            canvas.renderAll();
        }

        selectedObject.setCoords();
        canvas.requestRenderAll();
        forceUpdate((n) => n + 1); // Trigger React re-render to update UI inputs
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
        forceUpdate((n) => n + 1);
    };


    // Alignment Logic
    const handleAlign = (alignment: string) => {
        if (!canvas || !selectedObject) return;

        const center = selectedObject.getCenterPoint();

        selectedObject.set({
            textAlign: alignment,
            originX: alignment as any,
        });

        selectedObject.setPositionByOrigin(center, 'center', 'center');

        selectedObject.setCoords();
        canvas.requestRenderAll();
        updateProperty('textAlign', alignment);
        // Note: updateProperty already calls forceUpdate
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

    // History State
    const [history, setHistory] = useState<string[]>([]);
    const [historyStep, setHistoryStep] = useState(-1);
    const isHistoryProcessing = useRef(false);

    // Save History
    const saveHistory = (c: fabric.Canvas) => {
        if (isHistoryProcessing.current || switchingSideRef.current || isPreviewRef.current) return;

        const json = JSON.stringify(c.toObject(['data', 'isPhotoPlaceholder', 'isPlaceholder', 'id', 'selectable', 'isCircle']));

        setHistory(prev => {
            const newHistory = prev.slice(0, historyStep + 1);
            newHistory.push(json);
            return newHistory;
        });
        setHistoryStep(prev => prev + 1);
        saveCurrentSide(c);
    };

    // Undo
    const undo = async () => {
        if (historyStep <= 0 || !canvas) return;
        isHistoryProcessing.current = true;

        const prevStep = historyStep - 1;
        const json = history[prevStep];

        await canvas.loadFromJSON(JSON.parse(json));
        canvas.renderAll();
        setHistoryStep(prevStep);
        isHistoryProcessing.current = false;

        // Restore selection if possible, or just clear
        canvas.discardActiveObject();
        setSelectedObject(null);
    };

    // Redo
    const redo = async () => {
        if (historyStep >= history.length - 1 || !canvas) return;
        isHistoryProcessing.current = true;

        const nextStep = historyStep + 1;
        const json = history[nextStep];

        await canvas.loadFromJSON(JSON.parse(json));
        canvas.renderAll();
        setHistoryStep(nextStep);
        isHistoryProcessing.current = false;
    };


    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if input/textarea is focused
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;

            if (!canvas) return;

            // Undo / Redo
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                if (e.shiftKey) {
                    redo();
                } else {
                    undo();
                }
                return;
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                e.preventDefault();
                redo();
                return;
            }

            // Object Movement (Arrow Keys)
            const activeObj = canvas.getActiveObject();
            const isEditingText = (activeObj instanceof fabric.IText || activeObj instanceof fabric.Textbox) && activeObj.isEditing;

            if (activeObj && !isEditingText) {
                const step = e.shiftKey ? 10 : 1;
                switch (e.key) {
                    case 'ArrowUp':
                        e.preventDefault();
                        activeObj.set('top', (activeObj.top || 0) - step);
                        activeObj.setCoords();
                        canvas.requestRenderAll();
                        break;
                    case 'ArrowDown':
                        e.preventDefault();
                        activeObj.set('top', (activeObj.top || 0) + step);
                        activeObj.setCoords();
                        canvas.requestRenderAll();
                        break;
                    case 'ArrowLeft':
                        e.preventDefault();
                        activeObj.set('left', (activeObj.left || 0) - step);
                        activeObj.setCoords();
                        canvas.requestRenderAll();
                        break;
                    case 'ArrowRight':
                        e.preventDefault();
                        activeObj.set('left', (activeObj.left || 0) + step);
                        activeObj.setCoords();
                        canvas.requestRenderAll();
                        break;
                    case 'Delete':
                    case 'Backspace':
                        // Don't delete if editing text
                        if (!(activeObj instanceof fabric.IText && activeObj.isEditing)) {
                            e.preventDefault();
                            deleteSelected();
                        }
                        break;
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [canvas, history, historyStep, selectedObject]); // Dependencies for closure

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

            // Cap initial zoom to reasonable limits
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
    }, [width, height]);


    const isTextObject = (obj: fabric.FabricObject | null) => {
        if (!obj) return false;
        // Check for isEditing property existence or instance type
        return obj.type === 'i-text' || obj.type === 'textbox' || obj.type === 'text';
    };

    // Zoom Wheel Handler - Native Listener for Passive control
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const wrapper = wrapperRef.current;
        if (!wrapper) return;

        const handleWheel = (e: WheelEvent) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault(); // PREVENT BROWSER ZOOM
                e.stopPropagation();

                const delta = e.deltaY;
                const sensitivity = 0.005; // Matches StudentEditDialog
                const zoomStep = delta * sensitivity;

                setZoom(prev => {
                    const newZoom = prev - zoomStep;
                    return Math.min(Math.max(newZoom, 0.1), 3.0);
                });
            }
        };

        // Must be passive: false to allow preventDefault
        wrapper.addEventListener('wheel', handleWheel, { passive: false });

        return () => {
            wrapper.removeEventListener('wheel', handleWheel);
        };
    }, []);

    return (
        <div ref={wrapperRef} className="relative w-full h-full bg-[#0f0f13] overflow-hidden">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-20 pointer-events-none"
                style={{
                    backgroundImage: 'radial-gradient(circle at 1px 1px, #333 1px, transparent 0)',
                    backgroundSize: '24px 24px'
                }}
            />

            {/* Main Canvas Area */}
            <div className="absolute inset-0 flex items-center justify-center overflow-auto custom-scrollbar">
                <div ref={containerRef} className="min-w-full min-h-full relative flex items-center justify-center p-20">
                    <div className="relative flex flex-col items-center justify-center">
                        {/* Tabs overlapping the canvas top - Move out or keep? Keep close to canvas */}
                        <div className="absolute -top-12 left-1/2 -translate-x-1/2 z-10">
                            <Tabs value={activeSide} onValueChange={(v) => handleSideChange(v as 'front' | 'back')}>
                                <TabsList className="glass border-white/10 p-1 bg-black/40 backdrop-blur-md">
                                    <TabsTrigger value="front" className="w-24 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg text-white/70">Front</TabsTrigger>
                                    <TabsTrigger value="back" className="w-24 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-lg text-white/70">Back</TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>

                        <div
                            className="shadow-2xl shadow-black/50 transition-all duration-200 ease-out border border-white/5"
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
            </div>

            {/* Left Sidebar - Tools & Layers */}
            <div className="absolute left-6 top-24 bottom-6 w-72 glass border-white/10 rounded-2xl flex flex-col gap-0 overflow-hidden z-20 shadow-2xl shadow-black/50 backdrop-blur-xl bg-black/40">

                <Tabs value={activeLeftTab} onValueChange={setActiveLeftTab} className="h-full flex flex-col">
                    <div className="p-4 border-b border-white/5 bg-white/5 flex flex-col gap-3">
                        <TabsList className="grid w-full grid-cols-2 bg-black/40 border border-white/10 rounded-lg h-9 p-0.5">
                            <TabsTrigger value="assets" className="text-xs rounded-md data-[state=active]:bg-primary data-[state=active]:text-white">Assets</TabsTrigger>
                            <TabsTrigger value="layers" className="text-xs rounded-md data-[state=active]:bg-primary data-[state=active]:text-white">Layers ({layers.length})</TabsTrigger>
                        </TabsList>

                        {activeLeftTab === 'assets' && (
                            <Button
                                className={`w-full ${isPreview ? 'bg-orange-500 hover:bg-orange-600' : 'bg-primary/20 hover:bg-primary/30 text-primary border border-primary/20'} transition-all h-8 text-xs`}
                                onClick={togglePreview}
                            >
                                {isPreview ? <EyeOff className="w-3.5 h-3.5 mr-2" /> : <Eye className="w-3.5 h-3.5 mr-2" />}
                                {isPreview ? 'Exit Preview' : 'Live Preview'}
                            </Button>
                        )}
                        {isPreview && activeLeftTab === 'assets' && <p className="text-[10px] text-muted-foreground text-center animate-pulse">Editing locked</p>}
                    </div>

                    {/* Assets Tab Content */}
                    <TabsContent value="assets" className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6 mt-0 data-[state=inactive]:hidden">
                        <div className={`space-y-6 ${isPreview ? 'opacity-50 pointer-events-none' : ''}`}>
                            {/* Elements */}
                            <div className="space-y-3">
                                <Button variant="outline" size="sm" onClick={addText} className="w-fit h-9 px-4 justify-start border-white/10 hover:bg-white/10 hover:text-white dark-glass rounded-full">
                                    <Type className="w-4 h-4 mr-2 text-primary" /> Text
                                </Button>
                            </div>

                            {/* Media */}
                            <div className="space-y-3">
                                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold pl-1">Media</Label>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="relative">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleImageUpload}
                                            className="absolute inset-0 opacity-0 cursor-pointer z-10 w-full h-full"
                                        />
                                        <Button variant="outline" className="w-full h-10 justify-start border-white/10 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white gap-2">
                                            <ImageIcon className="w-4 h-4" /> Image
                                        </Button>
                                    </div>
                                    <Button variant="outline" onClick={addImagePlaceholder} className="w-full h-10 justify-start border-white/10 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white gap-2">
                                        <Square className="w-4 h-4" /> Rect Photo
                                    </Button>
                                    <Button variant="outline" onClick={addCirclePhotoPlaceholder} className="w-full h-10 justify-start border-white/10 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white gap-2 col-span-2">
                                        <Circle className="w-4 h-4" /> Circle Photo
                                    </Button>
                                </div>
                            </div>

                            {/* Shapes */}
                            <div className="space-y-3">
                                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold pl-1">Shapes</Label>
                                <div className="grid grid-cols-2 gap-3">
                                    <Button variant="outline" onClick={() => addShape('rect')} className="w-full h-10 justify-start border-white/10 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white gap-2">
                                        <Square className="w-4 h-4" /> Rect
                                    </Button>
                                    <Button variant="outline" onClick={() => addShape('circle')} className="w-full h-10 justify-start border-white/10 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white gap-2">
                                        <Circle className="w-4 h-4" /> Circle
                                    </Button>
                                </div>
                            </div>

                            {/* Dynamic Data */}
                            <div className="space-y-3">
                                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold pl-1">Data Fields</Label>
                                <div className="grid grid-cols-2 gap-2">
                                    {['name', 'roll_number', 'class', 'department', 'blood_group', 'email', 'phone', 'dob', 'address', 'guardian_name', 'batch'].map(field => (
                                        <Button
                                            key={field}
                                            variant="outline"
                                            size="sm"
                                            onClick={() => addPlaceholder(field)}
                                            className="justify-center font-mono text-[10px] h-9 px-1 truncate border-white/10 bg-white/5 hover:bg-primary/20 hover:text-primary hover:border-primary/50 transition-all text-muted-foreground rounded-full"
                                            title={`Add {{${field}}}`}
                                        >
                                            {`{{${field}}}`}
                                        </Button>
                                    ))}
                                </div>
                                <div className="flex gap-2 mt-4 pt-2 border-t border-white/5">
                                    <Input
                                        placeholder="custom_field"
                                        className="h-9 text-xs font-mono bg-black/40 border-white/10 focus-visible:ring-primary/50"
                                        id="custom-field-input"
                                    />
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        className="h-9 px-4 font-bold"
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
                        </div>
                    </TabsContent>

                    {/* Layers Tab Content */}
                    <TabsContent value="layers" className="flex-1 overflow-y-auto custom-scrollbar p-0 space-y-1 mt-0 data-[state=inactive]:hidden bg-inherit">
                        {layers.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground/40 text-xs gap-2">
                                <Layers className="w-8 h-8 opacity-50" />
                                <span>No layers yet</span>
                            </div>
                        ) : (
                            <div className="divide-y divide-white/5">
                                {layers.map((obj, i) => {
                                    // Determine icon and label
                                    let Icon = Square;
                                    let label = "Object";

                                    if (obj.type === 'i-text' || obj.type === 'text') {
                                        Icon = Type;
                                        label = (obj as any).text?.substring(0, 15) || "Text";
                                    } else if (obj.type === 'image') {
                                        Icon = ImageIcon;
                                        label = "Image";
                                    } else if (obj.type === 'rect') {
                                        Icon = Square;
                                        label = "Rectangle";
                                    } else if (obj.type === 'circle') {
                                        Icon = Circle;
                                        label = "Circle";
                                    } else if (obj.type === 'group') {
                                        if ((obj as any).isPhotoPlaceholder) {
                                            Icon = ImageIcon;
                                            label = "Photo Placeholder";
                                        }
                                    }

                                    const isSelected = selectedObject === obj;
                                    const isLocked = !obj.selectable; // Consistent check based on selectable
                                    const isVisible = obj.visible;

                                    return (
                                        <div
                                            key={i}
                                            className={`flex items-center gap-2 p-3 text-sm hover:bg-white/5 transition-colors cursor-pointer group ${isSelected ? 'bg-primary/10 border-l-2 border-primary' : 'border-l-2 border-transparent'}`}
                                            onClick={() => {
                                                if (canvas) {
                                                    canvas.setActiveObject(obj);
                                                    canvas.renderAll();
                                                    // updateLayers(canvas);
                                                }
                                            }}
                                        >
                                            <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                                            <span className={`flex-1 truncate text-xs font-medium ${isLocked ? 'text-muted-foreground' : 'text-white/80'}`}>{label}</span>

                                            <div className="flex items-center gap-1 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                                                {/* Visibility Toggle */}
                                                <Button
                                                    size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-white"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (canvas) {
                                                            const newVis = !obj.visible;
                                                            obj.set('visible', newVis);
                                                            if (!newVis) {
                                                                canvas.discardActiveObject(); // Deselect if hiding
                                                                setSelectedObject(null);
                                                            }
                                                            canvas.renderAll();
                                                            updateLayers(canvas);
                                                        }
                                                    }}
                                                >
                                                    {isVisible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3 text-muted-foreground/50" />}
                                                </Button>

                                                {/* Lock Toggle */}
                                                <Button
                                                    size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-white"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (canvas) {
                                                            const currentlyLocked = !obj.selectable;
                                                            obj.set({
                                                                selectable: !currentlyLocked,
                                                                evented: !currentlyLocked,
                                                                lockMovementX: !currentlyLocked,
                                                                lockMovementY: !currentlyLocked,
                                                                lockRotation: !currentlyLocked,
                                                                lockScalingX: !currentlyLocked,
                                                                lockScalingY: !currentlyLocked,
                                                            });
                                                            // If we just locked it, we should probably deselect it if it was selected
                                                            if (!currentlyLocked) {
                                                                canvas.discardActiveObject();
                                                                setSelectedObject(null);
                                                            }
                                                            canvas.renderAll();
                                                            updateLayers(canvas);
                                                        }
                                                    }}
                                                >
                                                    {isLocked ? <Lock className="w-3 h-3 text-muted-foreground hover:text-orange-400" /> : <Unlock className="w-3 h-3 opacity-50 hover:opacity-100" />}
                                                </Button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </div>

            {/* Right Sidebar - Properties */}
            <div className="absolute right-6 top-24 bottom-6 w-72 glass border-white/10 rounded-2xl flex flex-col z-20 shadow-2xl shadow-black/50 backdrop-blur-xl bg-black/40 overflow-hidden">
                <div className="p-4 border-b border-white/5 bg-white/5 flex justify-between items-center">
                    <h3 className="font-semibold text-sm text-white">Properties</h3>
                    <div className="flex items-center gap-1">
                        {selectedObject && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                    if (canvas && selectedObject) {
                                        // Lock logic for the main button - actually if it's selected it's UNLOCKED.
                                        // So clicking this should LOCK it.
                                        const obj = selectedObject;
                                        obj.set({
                                            selectable: false,
                                            evented: false,
                                            lockMovementX: true,
                                            lockMovementY: true,
                                            lockRotation: true,
                                            lockScalingX: true,
                                            lockScalingY: true,
                                        });
                                        canvas.discardActiveObject();
                                        setSelectedObject(null);
                                        canvas.renderAll();
                                        updateLayers(canvas);
                                    }
                                }}
                                className="h-8 w-8 text-muted-foreground hover:text-orange-400 hover:bg-orange-400/10"
                                title="Lock Object"
                            >
                                <Lock className="w-4 h-4" />
                            </Button>
                        )}
                        {selectedObject && (
                            <Button variant="ghost" size="icon" onClick={deleteSelected} className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        )}
                    </div>
                </div>

                <div className="p-4 overflow-y-auto custom-scrollbar flex-1">
                    {selectedObject ? (
                        <div className="space-y-6">
                            <div className="space-y-3">
                                <Label className="text-xs text-muted-foreground">Appearance</Label>
                                <div className="flex flex-col gap-3">
                                    <div className="flex gap-2 items-center">
                                        <div className="w-8 h-8 rounded-md border border-white/10 overflow-hidden relative group cursor-pointer">
                                            <Input
                                                type="color"
                                                value={selectedObject.fill as string || '#000000'}
                                                onChange={(e) => updateProperty('fill', e.target.value)}
                                                className="absolute inset-0 w-12 h-12 -top-2 -left-2 cursor-pointer p-0 border-none"
                                            />
                                        </div>
                                        <Input
                                            value={selectedObject.fill as string || '#000000'}
                                            onChange={(e) => updateProperty('fill', e.target.value)}
                                            className="flex-1 font-mono text-xs h-8 bg-black/20 border-white/10"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs text-muted-foreground">
                                            <span>Opacity</span>
                                            <span>{Math.round((selectedObject.opacity !== undefined ? selectedObject.opacity : 1) * 100)}%</span>
                                        </div>
                                        <Slider
                                            value={[(selectedObject.opacity !== undefined ? selectedObject.opacity : 1) * 100]}
                                            max={100}
                                            step={1}
                                            className="py-1"
                                            onValueChange={(vals) => updateProperty('opacity', vals[0] / 100)}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <Label className="text-xs text-muted-foreground">Arrangement</Label>
                                <div className="grid grid-cols-4 gap-1">
                                    <Button variant="outline" size="sm" className="text-muted-foreground border-white/10 hover:bg-white/10" onClick={() => handleLayer('front')} title="Bring to Front">
                                        <ChevronsUp className="h-4 w-4" />
                                    </Button>
                                    <Button variant="outline" size="sm" className="text-muted-foreground border-white/10 hover:bg-white/10" onClick={() => handleLayer('forward')} title="Bring Forward">
                                        <ChevronUp className="h-4 w-4" />
                                    </Button>
                                    <Button variant="outline" size="sm" className="text-muted-foreground border-white/10 hover:bg-white/10" onClick={() => handleLayer('backward')} title="Send Backward">
                                        <ChevronDown className="h-4 w-4" />
                                    </Button>
                                    <Button variant="outline" size="sm" className="text-muted-foreground border-white/10 hover:bg-white/10" onClick={() => handleLayer('back')} title="Send to Back">
                                        <ChevronsDown className="h-4 w-4" />
                                    </Button>
                                </div>
                                {(selectedObject.type === 'image' || selectedObject.type === 'rect') && (
                                    <Button variant="secondary" size="sm" className="w-full mt-2 bg-white/5 hover:bg-white/10 border border-white/10 text-muted-foreground" onClick={fitToCanvas}>
                                        <Maximize className="w-3 h-3 mr-2" /> Fit to Canvas
                                    </Button>
                                )}
                            </div>

                            {/* Text Specific Properties */}
                            {isTextObject(selectedObject) && (
                                <>
                                    <div className="space-y-3 pt-3 border-t border-white/5">
                                        <Label className="text-xs text-muted-foreground">Typography</Label>
                                        <div className="space-y-2">
                                            <Input
                                                type="number"
                                                value={(selectedObject as any).fontSize || 20}
                                                onChange={(e) => updateProperty('fontSize', parseInt(e.target.value))}
                                                className="h-8 bg-black/20 border-white/10"
                                                placeholder="Size"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <select
                                                className="w-full h-8 rounded-md border border-white/10 bg-black/20 px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-primary text-white"
                                                value={(selectedObject as any).fontFamily || 'Arial'}
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

                                        <div className="flex gap-1 bg-black/20 p-1 rounded-md border border-white/10">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className={`flex-1 h-7 ${(selectedObject as any).textAlign === 'left' ? 'bg-primary/20 text-primary' : 'hover:bg-white/5 text-muted-foreground'}`}
                                                onClick={() => handleAlign('left')}
                                            >
                                                <AlignLeft className="h-3 w-3" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className={`flex-1 h-7 ${(selectedObject as any).textAlign === 'center' ? 'bg-primary/20 text-primary' : 'hover:bg-white/5 text-muted-foreground'}`}
                                                onClick={() => handleAlign('center')}
                                            >
                                                <AlignCenter className="h-3 w-3" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className={`flex-1 h-7 ${(selectedObject as any).textAlign === 'right' ? 'bg-primary/20 text-primary' : 'hover:bg-white/5 text-muted-foreground'}`}
                                                onClick={() => handleAlign('right')}
                                            >
                                                <AlignRight className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground/50">
                            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                                <Move className="w-8 h-8 opacity-50" />
                            </div>
                            <p className="text-sm font-medium text-white/50">No Selection</p>
                            <p className="text-xs mt-1 max-w-[150px]">Click any element on the canvas to customize it</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Zoom Controls Overlay - Fixed center bottom */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 glass border-white/10 p-1.5 flex items-center gap-2 z-30 rounded-full shadow-xl shadow-black/50 bg-black/60 backdrop-blur-xl">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-white/10 text-white" onClick={() => setZoom(z => Math.max(0.2, z - 0.1))}>
                    <ZoomOut className="w-4 h-4" />
                </Button>
                <div className="px-2 min-w-[3rem] text-center font-mono text-xs text-white/80">{Math.round(zoom * 100)}%</div>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-white/10 text-white" onClick={() => setZoom(z => Math.min(2, z + 0.1))}>
                    <ZoomIn className="w-4 h-4" />
                </Button>
                <div className="w-px h-4 bg-white/10 mx-1" />
                <Button variant="ghost" size="sm" className="h-8 text-xs hover:bg-white/10 text-white/80 px-3 rounded-full" onClick={() => setZoom(1)}>Reset</Button>
            </div>
        </div >
    );
});
