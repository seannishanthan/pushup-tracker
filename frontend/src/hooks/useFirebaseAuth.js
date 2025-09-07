import { useEffect, useState } from "react";
import { auth } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

export function useFirebaseAuth() {
    const [initializing, setInitializing] = useState(true);
    const [user, setUser] = useState(null);

    useEffect(() => {
        if (!auth) {
            // Firebase not initialized
            setInitializing(false);
            return;
        }

        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                // Reload user to get the latest verification status
                try {
                    await firebaseUser.reload();
                } catch (error) {
                    console.error('Error reloading user:', error);
                }
            }
            setUser(firebaseUser);
            setInitializing(false);
        });

        return unsubscribe;
    }, []);

    return {
        initializing,
        user,
        isVerified: !!user?.emailVerified,
        isAuthenticated: !!user
    };
}
