import jsPDF from 'jspdf';
import { renderCardSide } from './cardRenderer';

interface PdfOptions {
    watermarkUrl?: string; // URL to watermark image
}

export const generateBatchProofPDF = async (
    students: any[],
    template: any,
    options: PdfOptions = {}
) => {
    // 1. Determine Orientation
    // Safely parse front_design if it's a string or nested
    let design = template.front_design;
    if (typeof design === 'string') {
        try { design = JSON.parse(design); } catch (e) { console.error("Parse error", e); }
    }
    // Handle specific nested structure if existing (sometimes it's { front_design: {...} })
    if (design?.front_design) design = design.front_design;

    // Fix: Use correct DB columns (card_width, card_height) or fallback to design values
    const templateWidth = template.card_width || design?.width || 1011;
    const templateHeight = template.card_height || design?.height || 638;
    const isLandscape = templateWidth > templateHeight;

    // 2. Configure PDF Layout
    // Landscape Cards -> Portrait PDF (A4) -> 2 cols x 4 rows (8 per page) - kept spacious for proof
    // Portrait Cards -> Landscape PDF (A4) -> 4 cols x 2 rows (8 per page)

    let pdf: jsPDF;
    let pageWidth, pageHeight, cardWidth, cardHeight, cols, rows, gapX, gapY, marginX, marginY;

    if (isLandscape) {
        // Landscape Card (85.6 x 54) on Portrait Page
        pdf = new jsPDF('p', 'mm', 'a4');
        pageWidth = 210;
        pageHeight = 297;

        cardWidth = 85.6;
        cardHeight = 54;

        cols = 2;
        rows = 4;
        gapX = 10;
        gapY = 15;

        // Dynamic Margin Calculation
        const totalContentW = (cols * cardWidth) + ((cols - 1) * gapX);
        marginX = (pageWidth - totalContentW) / 2;
        marginY = 20; // Top margin
    } else {
        // Portrait Card (54 x 85.6) on Landscape Page
        // Or Portrait Page? 
        // 54mm width. A4 Width 210. 3 cols = 162 + gaps. 3 fits easily.
        // Let's use Landscape PDF for better row space?
        // Landscape A4: 297W x 210H
        // Card: 54W x 85.6H
        // 4 cols = 216mm. Fits in 297.
        // 2 rows = 171.2mm. Fits in 210.

        pdf = new jsPDF('l', 'mm', 'a4');
        pageWidth = 297;
        pageHeight = 210;

        cardWidth = 54;
        cardHeight = 85.6;

        cols = 4;
        rows = 2;
        gapX = 15;
        gapY = 10;

        // Dynamic Margin Calculation
        const totalContentW = (cols * cardWidth) + ((cols - 1) * gapX);
        marginX = (pageWidth - totalContentW) / 2;
        marginY = 15;
    }

    const cardsPerPage = cols * rows;

    let currentCardIndex = 0;

    // Load watermark image
    let watermarkImg: HTMLImageElement | null = null;
    if (options.watermarkUrl) {
        try {
            watermarkImg = await new Promise((resolve) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => resolve(img);
                img.onerror = () => resolve(null); // Continue without if fails
                img.src = options.watermarkUrl!;
            });
        } catch (e) {
            console.warn("Failed to load watermark", e);
        }
    }

    // Helper to add watermark to current page
    const addWatermark = () => {
        if (!watermarkImg) return;

        // Set Transparency
        pdf.setGState(new (pdf as any).GState({ opacity: 0.15 })); // Light watermark

        // Tile the watermark
        const wmWidth = 60; // Size of watermark
        const aspect = (watermarkImg!.width || 1) / (watermarkImg!.height || 1);
        const drawH = wmWidth / aspect;

        const xCount = Math.ceil(pageWidth / 80);
        const yCount = Math.ceil(pageHeight / 80);

        for (let i = 0; i < xCount; i++) {
            for (let j = 0; j < yCount; j++) {
                const x = i * 80 + 20;
                const y = j * 80 + 40;

                // Add Image with Rotation (45 degrees)
                pdf.addImage(watermarkImg!, 'PNG', x, y, wmWidth, drawH, undefined, 'FAST', 45);
            }
        }

        // Restore Opacity
        pdf.setGState(new (pdf as any).GState({ opacity: 1.0 }));
    };

    while (currentCardIndex < students.length) {
        if (currentCardIndex > 0) pdf.addPage();

        // --- 1. Draw Cards First (Bottom Layer) ---
        for (let i = 0; i < cardsPerPage; i++) {
            if (currentCardIndex >= students.length) break;

            const student = students[currentCardIndex];

            // Render Front Side 
            const design = template.front_design?.front_design || template.front_design;

            // Render high quality for PDF
            const renderWidth = isLandscape ? 1011 : 638;
            const renderHeight = isLandscape ? 638 : 1011;

            try {
                const dataUrl = await renderCardSide(design, student, renderWidth, renderHeight);

                if (dataUrl) {
                    const col = i % cols;
                    const row = Math.floor(i / cols);

                    const x = marginX + (col * (cardWidth + gapX));
                    const y = marginY + (row * (cardHeight + gapY));

                    let finalImgToDraw = dataUrl;

                    // --- Rotation Logic from Print Generator ---
                    // Check if we need to rotate image?
                    // Slot Dimensions: cardWidth (W), cardHeight (H)
                    // Image Dimensions: from template/render props

                    const isSlotHorizontal = cardWidth > cardHeight;
                    // We know the render dimensions:
                    const imgW = renderWidth;
                    const imgH = renderHeight;
                    const isImageHorizontal = imgW > imgH;

                    if (isSlotHorizontal !== isImageHorizontal) {
                        // Mismatch detected. Rotate the IMAGE to fit the SLOT (90 deg).
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                            const tempImg = new Image();
                            tempImg.src = dataUrl;

                            await new Promise<void>((resolve) => {
                                tempImg.onload = () => resolve();
                                tempImg.onerror = () => resolve();
                                tempImg.src = dataUrl; // Trigger load
                            });

                            // Swap dimensions for the canvas to hold rotated image
                            canvas.width = tempImg.height;
                            canvas.height = tempImg.width;

                            // Rotate 90 degrees clockwise
                            ctx.translate(canvas.width / 2, canvas.height / 2);
                            ctx.rotate(Math.PI / 2);
                            ctx.drawImage(tempImg, -tempImg.width / 2, -tempImg.height / 2);

                            finalImgToDraw = canvas.toDataURL('image/png');
                        }
                    }

                    // --- Fit Logic ---
                    // Now that orientation matches, simple addImage should work, BUT
                    // jsPDF stretches. Let's ensure it fits cleanly.
                    // Actually, if we rotated, aspect ratio matches. If not, it matches.
                    // So simply adding it to the slot is fine.

                    pdf.addImage(finalImgToDraw, 'PNG', x, y, cardWidth, cardHeight);

                    // Draw Border around card
                    pdf.setDrawColor(200, 200, 200); // Light Gray
                    pdf.rect(x, y, cardWidth, cardHeight);
                }
            } catch (e) {
                console.error("Error rendering card for PDF", e);
            }

            currentCardIndex++;
        }

        // --- 2. Draw Watermark Second (Top Layer / Overlay) ---
        addWatermark();

        // --- 3. Add Footer ---
        pdf.setFontSize(8);
        pdf.setTextColor(150);
        pdf.text("Draft Proof - Not for Official Use - Generated by ID Perfect", pageWidth / 2, pageHeight - 5, { align: 'center' });
    }

    return pdf;
};
