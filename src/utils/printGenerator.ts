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
    filename: string = 'print_batch.pdf'
) => {
    try {
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        const cardWidth = 85.6;
        const cardHeight = 54;
        const marginX = 15; // Centered roughly
        const marginY = 10;
        const gapX = 5;
        const gapY = 2;

        const cols = 2;
        const rows = 5;
        const cardsPerSheet = cols * rows;

        let currentCardIndex = 0;

        // Helper to add a sheet of faces
        const addSheet = (images: string[]) => {
            // Loop through grid properties
            for (let i = 0; i < images.length; i++) {
                const img = images[i];
                if (!img) continue;

                const colIndex = i % cols;
                const rowIndex = Math.floor(i / cols);

                const x = marginX + (colIndex * (cardWidth + gapX));
                const y = marginY + (rowIndex * (cardHeight + gapY));

                doc.addImage(img, 'PNG', x, y, cardWidth, cardHeight);

                // Optional: Cut marks?
                doc.setDrawColor(200);
                doc.rect(x, y, cardWidth, cardHeight); // Light border for cutting
            }
        };


        // Process in chunks of 10
        for (let i = 0; i < imageDatums.length; i += cardsPerSheet) {
            if (i > 0) doc.addPage();

            const chunk = imageDatums.slice(i, i + cardsPerSheet);

            // 1. Draw Fronts
            addSheet(chunk.map(c => c.front));

            // 2. If Backs exist, add a NEW PAGE for Backs (Duplex friendly?)
            // Usually printers want Front Page 1, Back Page 1.
            // But aligned so that Back of Card 1 (Col 1) is behind Front of Card 1.
            // On the back sheet, Col 2 (Right) aligns with Front Col 1 (Left)?
            // Detailed Duplex logic:
            // Front Sheet: [C1] [C2]
            // Back Sheet:  [C2-Back] [C1-Back] (Mirrored)

            // For now, let's just do Fronts unless specifically asked for complex duplex.
            // The user prompt didn't specify duplex mirroring, just "10 ids".
            // I'll stick to Fronts for this pass to keep it simple, or add standard sequential pages.
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
