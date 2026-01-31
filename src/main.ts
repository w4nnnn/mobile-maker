import { SplashScreen } from '@capacitor/splash-screen';

// Ensure splash screen hides even if we fall back to this local page
window.addEventListener('load', async () => {
    try {
        await SplashScreen.hide();
    } catch (e) {
        console.error('Error hiding splash screen', e);
    }
});
