// App entry. OWNED BY THE UI BUILDER (replace freely). Boots settings, audio, save detection and the router.
import { loadSettings } from './core/save';
const app = document.getElementById('app')!;
app.textContent = 'Mow Money is loading.';
loadSettings();
