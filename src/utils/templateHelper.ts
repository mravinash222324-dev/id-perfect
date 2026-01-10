/**
 * Scans a Fabric.js design JSON (or object) to find all data-bound fields.
 * Looks for:
 * 1. Text with {{key}} pattern
 * 2. Objects with data.key or custom 'key' property
 * 3. Photo placeholders
 */
export function extractTemplateFields(design: any): Set<string> {
    const fields = new Set<string>();

    if (!design) return fields;

    // Handle stringified JSON
    let source = design;
    if (typeof source === 'string') {
        try { source = JSON.parse(source); } catch (e) { return fields; }
    }

    // Fabric.js typically has an 'objects' array at the root
    // But check if it's nested (our DB sometimes stores keys like { front_design: ... })
    // Flatten approach: recursive scan

    function scanObject(obj: any) {
        if (!obj || typeof obj !== 'object') return;

        // check arrays
        if (Array.isArray(obj)) {
            obj.forEach(item => scanObject(item));
            return;
        }

        // Check for 'objects' array (Canvas/Group)
        if (Array.isArray(obj.objects)) {
            scanObject(obj.objects);
        }

        // 1. Check for {{key}} pattern in 'text' property
        if (typeof obj.text === 'string') {
            const matches = obj.text.match(/{{(.*?)}}/g);
            if (matches) {
                matches.forEach((m: string) => {
                    // Extract inner key: {{ exact_key }} -> exact_key
                    const clean = m.replace(/{{|}}/g, '').trim();
                    if (clean) fields.add(clean);
                });
            }
        }

        // 2. Check for explicit data binding (data.key or root 'key')
        // Some implementations put it in 'data' object, others at root
        const key = obj.key || (obj.data && obj.data.key);
        if (typeof key === 'string' && key.trim()) {
            fields.add(key.trim());
        }

        // 3. Check for Photo Placeholder
        // Often marked with 'isPhotoPlaceholder' boolean
        const isPhoto = obj.isPhotoPlaceholder || (obj.data && obj.data.isPhotoPlaceholder);
        if (isPhoto) {
            fields.add('photo_ref');
        }
    }

    scanObject(source);
    return fields;
}
