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
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        // 1. Define Slot Size (CR80 Standard Slot on A4)
        const slotWidth = 85.6;
        const slotHeight = 54;

        const marginX = 15; // Centered roughly
        const marginY = 10;
        const gapX = 5;
        const gapY = 2;

        const cols = 2;
        const rows = 5;
        const cardsPerSheet = cols * rows;

        // Helper to add a sheet of faces
        const addSheet = (images: string[]) => {
            // Loop through grid properties
            for (let i = 0; i < images.length; i++) {
                const img = images[i];
                if (!img) continue;

                const colIndex = i % cols;
                const rowIndex = Math.floor(i / cols);

                const slotX = marginX + (colIndex * (slotWidth + gapX));
                const slotY = marginY + (rowIndex * (slotHeight + gapY));

                // 2. Calculate Aspect Ratio Fit
                let drawW = slotWidth;
                let drawH = slotHeight;
                let drawX = slotX;
                let drawY = slotY;

                if (dimensions && dimensions.width > 0 && dimensions.height > 0) {
                    const imgRatio = dimensions.width / dimensions.height;
                    const slotRatio = slotWidth / slotHeight;

                    // If Image is Portrait and Slot is Landscape (and significant diff), 
                    // maybe we should rotate? 
                    // For now, let's just FIT (contain) to prevent invalid cutting.
                    // Or typically, ID cards printed on A4 sheets SHOULD be rotated if they are vertical design.

                    // Simple "Contain" logic:
                    if (imgRatio > slotRatio) {
                        // Image is wider than slot (relative to height) -> Constrain by Width
                        drawW = slotWidth;
                        drawH = slotWidth / imgRatio;
                        // Center vertically
                        drawY = slotY + (slotHeight - drawH) / 2;
                    } else {
                        // Image is taller than slot -> Constrain by Height
                        drawH = slotHeight;
                        drawW = slotHeight * imgRatio;
                        // Center horizontally
                        drawX = slotX + (slotWidth - drawW) / 2;
                    }
                }

                doc.addImage(img, 'PNG', drawX, drawY, drawW, drawH);

                // Optional: Cut marks (Always draw full slot size reference)
                doc.setDrawColor(200);
                doc.rect(slotX, slotY, slotWidth, slotHeight); // Light border to show the "Cell"
            }
        };


        // Process in chunks of 10
        for (let i = 0; i < imageDatums.length; i += cardsPerSheet) {
            if (i > 0) doc.addPage();

            const chunk = imageDatums.slice(i, i + cardsPerSheet);

            // 1. Draw Fronts
            addSheet(chunk.map(c => c.front));

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
