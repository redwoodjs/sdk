// This function should only split the audio if the file is more than 100kb  otherwise it myst be split into chunks no more than 100kb  
async function getAudioChunks(mediaUrl: string) {
    const res = await fetch(mediaUrl);
    const arrayBuffer = await res.arrayBuffer();
    const fileBytes = new Uint8Array(arrayBuffer);
    const totalSize = fileBytes.length;
    const MAX_CHUNK_SIZE = 90 * 1024; // 90KB in bytes
    
    console.log('File size:', totalSize);

    // If file is smaller than 100KB, return it as a single chunk
    if (totalSize <= MAX_CHUNK_SIZE) {
        const base64String = btoa(String.fromCharCode.apply(null, fileBytes));
        return [base64String];
    }

    // Find all OGG pages and their positions
    const oggPages = [];
    for (let i = 0; i < totalSize - 4; i++) {
        if (fileBytes[i] === 0x4F && // 'O'
            fileBytes[i + 1] === 0x67 && // 'g'
            fileBytes[i + 2] === 0x67 && // 'g'
            fileBytes[i + 3] === 0x53) { // 'S'
            oggPages.push(i);
        }
    }

    console.log('Found OGG pages:', oggPages.length);

    // Get header size (first three pages)
    const headerSize = oggPages[2];
    
    // Calculate effective chunk size to account for headers
    const EFFECTIVE_CHUNK_SIZE = MAX_CHUNK_SIZE - headerSize;
    
    // Calculate number of chunks needed
    const dataSize = totalSize - headerSize;
    const numChunks = Math.ceil(dataSize / EFFECTIVE_CHUNK_SIZE);
    
    // Create chunks
    const chunks = [];
    for (let i = 0; i < numChunks; i++) {
        const startPos = i === 0 ? 
            headerSize : 
            oggPages[oggPages.findIndex(pos => pos > (headerSize + (i * EFFECTIVE_CHUNK_SIZE)))];
        
        const endPosIndex = oggPages.findIndex(pos => pos > (headerSize + ((i + 1) * EFFECTIVE_CHUNK_SIZE)));
        const endPos = endPosIndex !== -1 ? oggPages[endPosIndex] : totalSize;
        
        const chunk = new Uint8Array([
            ...fileBytes.slice(0, headerSize), // Include headers
            ...fileBytes.slice(startPos, endPos) // Include data portion
        ]);
        
        // Verify chunk size
        if (chunk.length > MAX_CHUNK_SIZE) {
            console.warn(`Chunk ${i} exceeds MAX_CHUNK_SIZE: ${chunk.length} bytes`);
        }
        chunks.push(chunk);
    }

    // Convert chunks to base64 strings
    const chunkSize = 0x8000; // 32KB chunks for base64 conversion
    const base64Chunks = [];
    
    for (const chunk of chunks) {
        let base64String = '';
        const totalChunks = Math.ceil(chunk.length / chunkSize);
        console.log(`Processing chunk in ${totalChunks} parts`);
        
        for (let i = 0; i < chunk.length; i += chunkSize) {
            const subChunk = chunk.slice(i, i + chunkSize);
            base64String += btoa(String.fromCharCode.apply(null, subChunk));
            console.log(`Processed part ${Math.floor(i / chunkSize) + 1}/${totalChunks}`);
        }
        base64Chunks.push(base64String);
    }

    return base64Chunks;
}

export default getAudioChunks;