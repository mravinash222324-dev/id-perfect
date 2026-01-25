import jsPDF from 'jspdf';
import { toast } from 'sonner';

interface PrintConfig {
    paperSize: 'a4';
    orientation: 'portrait';
    cardsPerPage: 10;
    margin: number; // mm
    spacing: number; // mm
}

interface CardDimension {
    width: number; // mm
    height: number; // mm
}

// Standard CR80 Card: 85.6mm x 54mm
// A4: 210mm x 297mm
// 2 cols: 85.6 * 2 = 171.2mm. Leftover: 38.8mm. Margin: ~19mm left/right.
// 5 rows: 54 * 5 = 270mm. Leftover: 27mm. Margin: ~13mm top/bottom.

export const generateA4BatchPDF = async (
    imageDatums: { front: string, back?: string }[], // Array of base64 PNGs
    filename: string = 'print_batch.pdf',
    dimensions?: { width: number; height: number } // Optional template dimensions to calculate ratio
) => {
    try {
        const doc = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
        });

        // 1. Define Slot Size (CR80 Standard Slot - Vertical/Portrait)
        // Since PDF is Landscape, we print cards vertically upright.
        const slotWidth = 54;
        const slotHeight = 85.6;

        // Grid: 5 cols x 2 rows
        // Width: 297mm. 
        // Cards: 5 * 54 = 270mm. 
        // Gaps (4): 4 * 2 = 8mm. 
        // Total Content Width: 278mm.
        // Leftover: 297 - 278 = 19mm. Margin X: 9.5mm.

        // Height: 210mm.
        // Cards: 2 * 85.6 = 171.2mm.
        // Gaps (1): 1 * 5 = 5mm.
        // Total Content Height: 176.2mm.
        // Leftover: 210 - 176.2 = 33.8mm. Margin Y: 16.9mm.

        const marginX = 9.5;
        const marginY = 16.9;
        const gapX = 2; // 2mm horizontal gap between columns
        const gapY = 5; // 5mm vertical gap between rows

        const cols = 5;
        const rows = 2;
        const cardsPerSheet = cols * rows;

        // Helper to add a sheet of faces
        const addSheet = async (images: string[]) => {
            // Loop through grid properties
            for (let i = 0; i < images.length; i++) {
                const img = images[i];
                if (!img) continue;

                const colIndex = i % cols;
                const rowIndex = Math.floor(i / cols);

                const slotX = marginX + (colIndex * (slotWidth + gapX));
                const slotY = marginY + (rowIndex * (slotHeight + gapY));

                let drawW = slotWidth;
                let drawH = slotHeight;
                let drawX = slotX;
                let drawY = slotY;

                let finalImgToDraw = img;
                let currentImgWidth = dimensions?.width;
                let currentImgHeight = dimensions?.height;

                // Check Dimensions/Ratio for rotation
                if (currentImgWidth && currentImgHeight && currentImgWidth > 0 && currentImgHeight > 0) {
                    // Logic Flip: Slot is Portrait (54x85). 
                    // If Image is Landscape (w > h), we must rotate it 90 degrees to fit.
                    if (currentImgWidth > currentImgHeight) {
                        // Create rotation canvas
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                            const tempImg = new Image();
                            tempImg.src = img;

                            // Wait for image to load
                            await new Promise<void>((resolve, reject) => {
                                tempImg.onload = () => resolve();
                                tempImg.onerror = (e) => {
                                    console.error("Error loading image for rotation:", e);
                                    resolve();
                                };
                            });

                            // Swap dimensions for the canvas
                            canvas.width = tempImg.height;
                            canvas.height = tempImg.width;

                            // Rotate 90 degrees clockwise
                            ctx.translate(canvas.width / 2, canvas.height / 2);
                            ctx.rotate(Math.PI / 2); // 90 degrees
                            ctx.drawImage(tempImg, -tempImg.width / 2, -tempImg.height / 2);

                            finalImgToDraw = canvas.toDataURL('image/png');

                            // Update current dimensions to reflect the rotated image's dimensions (Swap)
                            const temp = currentImgWidth;
                            currentImgWidth = currentImgHeight;
                            currentImgHeight = temp;
                        }
                    }

                    // Fit Logic
                    const imgRatio = currentImgWidth / currentImgHeight;
                    const slotRatio = slotWidth / slotHeight;

                    if (imgRatio > slotRatio) {
                        // Image is wider than slot (relative to height) -> Constrain by Width
                        drawW = slotWidth;
                        drawH = slotWidth / imgRatio;
                        drawY = slotY + (slotHeight - drawH) / 2;
                    } else {
                        // Image is taller than slot -> Constrain by Height
                        drawH = slotHeight;
                        drawW = slotHeight * imgRatio;
                        drawX = slotX + (slotWidth - drawW) / 2;
                    }
                }

                doc.addImage(finalImgToDraw, 'PNG', drawX, drawY, drawW, drawH);
                // Border removed
            }
        };


        // Process in chunks of 10
        for (let i = 0; i < imageDatums.length; i += cardsPerSheet) {
            if (i > 0) doc.addPage();

            const chunk = imageDatums.slice(i, i + cardsPerSheet);

            // 1. Draw Fronts
            await addSheet(chunk.map(c => c.front));

            // Backs skipped for now as per previous logic
        }

        doc.save(filename);
        toast.success("PDF Batch Generated Successfully");
        return true;

    } catch (error) {
        console.error("PDF Generation Error:", error);
        toast.error("Failed to generate PDF");
        return false;
    }
};
