// Validation middleware for pushup session data
const validateSession = (req, res, next) => {
    const { count, startedAt, endedAt, notes } = req.body;
    const errors = [];
    const isUpdate = req.method === 'PUT';

    // Validate count (required for POST, optional for PUT)
    if (!isUpdate) {
        // For creating new sessions, count is required
        if (count === undefined || count === null) {
            errors.push('Count is required');
        } else if (!Number.isInteger(count) || count < 0) {
            errors.push('Count must be a non-negative integer');
        }
    } else {
        // For updates, count is optional but must be valid if provided
        if (count !== undefined && (!Number.isInteger(count) || count < 0)) {
            errors.push('Count must be a non-negative integer');
        }
    }

    // Validate dates
    if (startedAt && !Date.parse(startedAt)) {
        errors.push('Invalid startedAt date format');
    }
    if (endedAt && !Date.parse(endedAt)) {
        errors.push('Invalid endedAt date format');
    }
    if (startedAt && endedAt && new Date(endedAt) < new Date(startedAt)) {
        errors.push('endedAt must be after startedAt');
    }

    // Validate notes
    if (notes && notes.length > 500) {
        errors.push('Notes cannot exceed 500 characters');
    }

    // For updates, ensure at least one field is provided
    if (isUpdate) {
        const hasUpdates = count !== undefined || startedAt || endedAt || notes !== undefined;
        if (!hasUpdates) {
            errors.push('At least one field must be provided for update');
        }
    }

    if (errors.length > 0) {
        return res.status(400).json({ 
            success: false, 
            message: 'Validation errors', 
            errors 
        });
    }

    next();
};

module.exports = validateSession;
