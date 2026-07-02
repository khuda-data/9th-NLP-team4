export async function* analyze(repoUrl: string) {
    console.log(`analyze start: ${repoUrl}`);
    const res = await fetch(`${import.meta.env.VITE_BASE_URL}/analyze`, {
        method: 'POST',
        headers: {
            "Content-Type": `application/json`
        },
        body: JSON.stringify({
            repoUrl,
        })
    });

    console.log('backend api connected');
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();

    while(true) {
        const {done, value} = await reader.read();
        if(done) return;
        yield decoder.decode(value, {stream:true});
    }
}