const urls = [
    "https://www.lettuceclub.net/recipe/kondate/detail/k20260216/"
];

async function test() {
    try {
        const response = await fetch('http://localhost:3000/api/aggregate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ urls })
        });

        const text = await response.text();
        console.log('Status:', response.status);
        console.log('Body:', text);
    } catch (e) {
        console.error(e);
    }
}

test();
