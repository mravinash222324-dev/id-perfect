
import * as fabric from 'fabric';

/**
 * Renders a single ID card side (front/back) to a Base64 PNG string.
 */
export const renderCardSide = async (
    designJson: any,
    student: any,
    width: number,
    height: number
): Promise<string> => {
    // Create a temporary canvas element
    const canvasEl = document.createElement('canvas');
    canvasEl.width = width;
    canvasEl.height = height;

    const canvas = new fabric.StaticCanvas(canvasEl);

    // Load the design
    // Handle stringified JSON if needed
    let source = designJson;
    if (typeof source === 'string') {
        try { source = JSON.parse(source); } catch (e) { console.error("JSON parse error", e); return ''; }
    }

    if (!source) return ''; // Empty design

    await canvas.loadFromJSON(source);

    // Perform Replacements
    await performReplacements(canvas, student);

    canvas.renderAll();
    const dataUrl = canvas.toDataURL({ format: 'png', multiplier: 1 });

    // Cleanup
    canvas.dispose();

    return dataUrl;
};


/**
 * Helper to replace {{keys}} and photo placeholders
 */
async function performReplacements(canvas: fabric.StaticCanvas, student: any) {
    const objects = canvas.getObjects();

    // 1. Text Replacement
    objects.forEach((obj: any) => {
        // Handle {{key}} logic
        if (obj.type === 'i-text' && obj.text?.includes('{{') && obj.text?.includes('}}')) {
            let newText = obj.text.replace(/{{(.*?)}}/g, (match: string, key: string) => {
                const cleanKey = key.trim();
                const val = student[cleanKey];
                return (val !== null && val !== undefined) ? String(val) : match;
            });
            obj.set({ text: newText });
        }

        // Handle data-binding logic (obj.data.key)
        if (obj.data?.key || (obj as any).key) { // (obj as any).key support legacy
            const key = obj.data?.key || (obj as any).key;
            const val = student[key];
            if (val !== null && val !== undefined) {
                obj.set({ text: String(val) });
            }
        }
    });

    // 2. Photo Replacement
    const photoPlaceholder = objects.find((obj: any) => obj.data?.isPhotoPlaceholder || (obj as any).isPhotoPlaceholder);

    if (photoPlaceholder && student.photo_url) {
        try {
            const imgUrl = student.photo_url;

            const imgElement = await new Promise<HTMLImageElement>((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = 'anonymous'; // Critical for CORS
                img.onload = () => resolve(img);
                img.onerror = (e) => reject(e);
                img.src = imgUrl; // Ensure this URL is accessible
            });

            const fabricImage = new fabric.Image(imgElement);

            // Legacy Scale/Fit Logic from IDCards.tsx
            const phWidth = photoPlaceholder.width! * (photoPlaceholder.scaleX || 1);
            const phHeight = photoPlaceholder.height! * (photoPlaceholder.scaleY || 1);
            const phLeft = photoPlaceholder.left!;
            const phTop = photoPlaceholder.top!;

            const centerX = phLeft + (phWidth / 2);
            const centerY = phTop + (phHeight / 2);

            const scaleX = phWidth / fabricImage.width!;
            const scaleY = phHeight / fabricImage.height!;
            const scale = Math.max(scaleX, scaleY); // Cover

            const isCircle = (photoPlaceholder as any).isCircle;
            let clipPath;

            if (isCircle) {
                clipPath = new fabric.Circle({
                    radius: phWidth / 2 / scale,
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
                clipPath: clipPath
            });

            canvas.remove(photoPlaceholder);
            canvas.add(fabricImage);
            // Ensure photo is at correct Z-index? Usually placeholders are on top or middle. 
            // Ideally we'd preserve index, but adding puts it on top. 
            // `canvas.insertAt` if we knew index. For now simple add is okay.

        } catch (err) {
            console.warn(`Could not load photo for student ${student.name}`, err);
        }
    }
}
