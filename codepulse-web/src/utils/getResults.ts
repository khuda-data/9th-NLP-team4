export const getResults = async (jobId:string) => {
    console.log(`getResults start: ${jobId}`);
    const res = await (await fetch(`${import.meta.env.VITE_BASE_URL}/${jobId}/results`, {
        method: 'GET',
        headers: {
            "Content-Type": `application/json`
        },
    })).json();
    console.log(res);
    return res;
}