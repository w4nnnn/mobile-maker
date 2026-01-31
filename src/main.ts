import { SplashScreen } from '@capacitor/splash-screen';

// Hide the splash screen after the app has loaded
window.addEventListener('load', async () => {
    try {
        await SplashScreen.hide();
    } catch (e) {
        console.error('Error hiding splash screen', e);
    }
});
