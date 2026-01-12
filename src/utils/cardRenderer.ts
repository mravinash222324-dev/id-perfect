
import * as fabric from 'fabric';

/**
 * Renders a single ID card side (front/back) to a Base64 PNG string.
 */
/**
 * Renders a single ID card side (front/back) to a Base64 PNG string.
 */
export const renderCardSide = async (
    designJson: any,
    student: any,
    width: number,
    height: number,
    bulkPhotos?: Map<string, File>
): Promise<string> => {
    // Create a temporary canvas element
    const canvasEl = document.createElement('canvas');
    canvasEl.width = width;
    canvasEl.height = height;

    const canvas = new fabric.StaticCanvas(canvasEl);

    // Load the design
    let source = designJson;
    if (typeof source === 'string') {
        try { source = JSON.parse(source); } catch (e) { console.error("JSON parse error", e); return ''; }
    }

    if (!source) return ''; // Empty design

    await canvas.loadFromJSON(source);

    // Perform Replacements
    await performReplacements(canvas, student, bulkPhotos);

    canvas.renderAll();
    const dataUrl = canvas.toDataURL({ format: 'png', multiplier: 1 });

    // Cleanup
    canvas.dispose();

    return dataUrl;
};


/**
 * Helper to replace {{keys}} and photo placeholders
 */
async function performReplacements(canvas: fabric.StaticCanvas, student: any, bulkPhotos?: Map<string, File>) {
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
    // Find the placeholder object
    const photoPlaceholder = objects.find((obj: any) => (obj.data?.isPhotoPlaceholder) || (obj as any).isPhotoPlaceholder);

    if (photoPlaceholder) {
        try {
            let imgUrl = student.photo_url;

            // Debug Matching from Bulk Photos if no URL
            if (!imgUrl && bulkPhotos && bulkPhotos.size > 0) {
                // Try matching by Roll Number (primary) or specific field if needed
                const rollKey = student.roll_number?.toLowerCase().trim();
                // Also could match by Photo Ref if present
                const refKey = student.photo_ref?.toLowerCase().trim();

                let file: File | undefined;
                if (rollKey && bulkPhotos.has(rollKey)) file = bulkPhotos.get(rollKey);
                else if (refKey && bulkPhotos.has(refKey)) file = bulkPhotos.get(refKey);

                if (file) {
                    imgUrl = URL.createObjectURL(file);
                }
            }

            if (imgUrl) {
                const imgElement = await new Promise<HTMLImageElement>((resolve, reject) => {
                    const img = new Image();
                    img.crossOrigin = 'anonymous'; // Critical for CORS
                    img.onload = () => resolve(img);
                    img.onerror = (e) => reject(e);
                    img.src = imgUrl!; // Ensure this URL is accessible
                });

                const fabricImage = new fabric.Image(imgElement);

                // --- ROBUST PLACEMENT LOGIC ---
                // 1. Get placeholder dimensions and center
                // Use getCenterPoint to handle any origin (left, center, custom)
                const center = photoPlaceholder.getCenterPoint();
                const phWidth = photoPlaceholder.getScaledWidth();
                const phHeight = photoPlaceholder.getScaledHeight();

                // 2. Calculate Scale to COVER the placeholder area
                const scaleX = phWidth / fabricImage.width!;
                const scaleY = phHeight / fabricImage.height!;
                const scale = Math.max(scaleX, scaleY); // 'cover' fit

                // 3. Handle Clipping (Circle vs Rect)
                const isCircle = (photoPlaceholder as any).isCircle || (photoPlaceholder as any).data?.isCircle;
                let clipPath;

                // ClipPath is relative to the *image's* center (0,0)
                if (isCircle) {
                    clipPath = new fabric.Circle({
                        radius: Math.min(phWidth, phHeight) / 2 / scale, // Radius in original image pixels
                        originX: 'center',
                        originY: 'center',
                        left: 0,
                        top: 0
                    });
                } else {
                    clipPath = new fabric.Rect({
                        width: phWidth / scale,
                        height: phHeight / scale,
                        originX: 'center',
                        originY: 'center',
                        left: 0,
                        top: 0
                    });
                }

                // 4. Configure New Image
                fabricImage.set({
                    left: center.x,
                    top: center.y,
                    originX: 'center', // Always place by center
                    originY: 'center',
                    scaleX: scale,
                    scaleY: scale,
                    clipPath: clipPath
                });

                // 5. Insert at correct Z-index
                const placeholderIndex = canvas.getObjects().indexOf(photoPlaceholder);
                
                // Remove placeholder
                canvas.remove(photoPlaceholder);

                // Insert new image at specific index to preserve layering (e.g. below frames/text)
                if (placeholderIndex >= 0) {
                    canvas.insertAt(placeholderIndex, fabricImage);
                } else {
                    canvas.add(fabricImage);
                }

            }
        } catch (err) {
            console.warn(`Could not load photo for student ${student.name}`, err);
        }
    }
}
