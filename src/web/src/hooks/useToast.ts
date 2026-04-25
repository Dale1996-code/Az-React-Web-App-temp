import { useState, useEffect } from 'react';

export function useToast(duration = 3000) {
    const [message, setMessage] = useState<string | null>(null);

    useEffect(() => {
        if (!message) return;
        const id = setTimeout(() => setMessage(null), duration);
        return () => clearTimeout(id);
    }, [message, duration]);

    return { toastMessage: message, showToast: setMessage };
}
