import { extractTemplateVars } from './cardRenderer';

export const getRequiredFields = (template: any): string[] => {
    if (!template) {
        return ['name', 'roll_number', 'class', 'photo_url'];
    }

    const frontVars = extractTemplateVars(template.front_design);
    const backVars = extractTemplateVars(template.back_design);

    // Merge all vars and ensure mandatory ones are present
    const allVars = new Set([...frontVars, ...backVars, 'name', 'roll_number', 'photo_url']);

    return Array.from(allVars);
};

export const validateStudent = (student: any, requiredFields: string[]): string[] => {
    const errors: string[] = [];

    // Always Required (Hard checks)
    if (!student.name || String(student.name).trim() === '') errors.push('Name');
    if (!student.roll_number || String(student.roll_number).trim() === '') errors.push('Roll Number');
    if (!student.photo_url) errors.push('Photo');

    // Dynamic Validation based on Template
    requiredFields.forEach(field => {
        // Skip fields already checked or system fields
        if (['name', 'roll_number', 'photo_url', 'id', 'created_at', 'school_id', 'print_batch_id'].includes(field)) return;

        // Check if map fields are empty
        const val = student[field];
        if (!val || String(val).trim() === '') {
            // Format field name for UI
            const label = field.charAt(0).toUpperCase() + field.slice(1).replace('_', ' ');
            errors.push(label);
        }
    });

    return errors;
};
