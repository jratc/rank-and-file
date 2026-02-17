
const { universalProvider } = require('./lib/universal');

async function test() {
    const names = ['Birdsong', 'Angler', 'Mourad', 'Selby\'s', 'Wako'];
    const category = 'restaurants';

    for (const name of names) {
        console.log(`Testing: ${name}`);
        const url = await universalProvider.fetchThumbnail(name, category);
        console.log(`Result: ${url || 'FAILED'}`);
        console.log('---');
    }
}

test();
