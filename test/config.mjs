
import akasha from 'akasharender';
import { BooknavPlugin } from '../index.mjs';
const __dirname = import.meta.dirname;

const config = new akasha.Configuration();
config.rootURL("https://example.akashacms.com");
config.configDir = __dirname;
config.addLayoutsDir('layouts')
    .addDocumentsDir('documents');
config.use(BooknavPlugin);
config.setMahabhutaConfig({
    recognizeSelfClosing: true,
    recognizeCDATA: true,
    decodeEntities: true
});
config.prepare();

export default config;
