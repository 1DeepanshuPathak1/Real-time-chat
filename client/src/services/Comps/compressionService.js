class CompressionService {
    decompressLZW(compressed) {
        try {
            if (!compressed || typeof compressed !== 'string') {
                return compressed;
            }

            const binaryString = atob(compressed);
            const uint8Array = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                uint8Array[i] = binaryString.charCodeAt(i);
            }
            
            const codes = Array.from(uint8Array);
            const dict = new Map();
            let dictSize = 256;
            let result = '';
            
            if (codes.length === 0) return compressed;
            
            let w = String.fromCharCode(codes[0]);
            result += w;
            
            for (let i = 0; i < 256; i++) {
                dict.set(i, String.fromCharCode(i));
            }
            
            for (let i = 1; i < codes.length; i++) {
                const k = codes[i];
                let entry;
                
                if (dict.has(k)) {
                    entry = dict.get(k);
                } else if (k === dictSize) {
                    entry = w + w[0];
                } else {
                    console.warn('Invalid compression code:', k);
                    return compressed;
                }
                
                result += entry;
                dict.set(dictSize++, w + entry[0]);
                w = entry;
            }
            
            const resultBytes = Array.from(result, c => c.charCodeAt(0));
            const resultBinary = String.fromCharCode(...resultBytes);
            return atob(resultBinary);
        } catch (error) {
            console.error('Decompression failed:', error);
            return compressed;
        }
    }

    compressLZW(data) {
        try {
            const dict = new Map();
            let dictSize = 256;
            const result = [];
            let w = '';
            
            for (let i = 0; i < 256; i++) {
                dict.set(String.fromCharCode(i), i);
            }
            
            for (let i = 0; i < data.length; i++) {
                const c = data[i];
                const wc = w + c;
                
                if (dict.has(wc)) {
                    w = wc;
                } else {
                    result.push(dict.get(w));
                    dict.set(wc, dictSize++);
                    w = c;
                }
            }
            
            if (w !== '') {
                result.push(dict.get(w));
            }
            
            const uint8Array = new Uint8Array(result);
            const binaryString = Array.from(uint8Array, byte => String.fromCharCode(byte)).join('');
            return btoa(binaryString);
        } catch (error) {
            console.error('LZW compression error:', error);
            return btoa(data);
        }
    }
}

export default new CompressionService();