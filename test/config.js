
const akasha   = require('akasharender');
const booknav = require('../index');

config = new akasha.Configuration();
config.rootURL("https://example.akashacms.com");
config.configDir = __dirname;
config.addLayoutsDir('layouts')
    .addDocumentsDir('documents');
config.use(booknav);
config.setMahabhutaConfig({
    recognizeSelfClosing: true,
    recognizeCDATA: true,
    decodeEntities: true
});
config.prepare();

module.exports = config;

