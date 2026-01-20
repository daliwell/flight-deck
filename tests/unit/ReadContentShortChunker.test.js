const ReadContentShortChunker = require('../../src/services/ReadContentShortChunker');
const { CHUNK_TYPES } = require('../../src/constants/chunkers');

describe('ReadContentShortChunker', () => {
  let chunker;

  beforeEach(() => {
    chunker = new ReadContentShortChunker();
  });

  describe('Caption Extraction', () => {
    test('should extract caption for code blocks', () => {
      const html = `
        <div class="content">
          <p>Listing 9: Mit der watch-Funktion wird auf Veränderungen im Formular reagiert</p>
          <div class="codelisting">
            <pre><code>function ReservationForm() {
  const form = useForm({ /*...*/ });
  const [start, end, guests] = form.watch([
    "reservationPeriod.start",
    "reservationPeriod.end",
    "guests"
  ]);
}</code></pre>
          </div>
        </div>
      `;

      const chunks = chunker.processXHTML(html);
      
      const codeChunk = chunks.find(chunk => chunk.chunkType === CHUNK_TYPES.CODE);
      expect(codeChunk).toBeDefined();
      expect(codeChunk.metadata.caption).toBe('Listing 9: Mit der watch-Funktion wird auf Veränderungen im Formular reagiert');
      expect(codeChunk.chunkContent).toContain('function ReservationForm()');
    });

    test('should extract caption for tables', () => {
      const html = `
        <div class="content">
          <p>Tabelle 1: Liste der verfügbaren Funktionen</p>
          <div class="Tabelle">
            <table>
              <tr><th>Function</th><th>Description</th></tr>
              <tr><td>useState</td><td>State management</td></tr>
            </table>
          </div>
        </div>
      `;

      const chunks = chunker.processXHTML(html);
      
      const tableChunk = chunks.find(chunk => chunk.chunkType === CHUNK_TYPES.TABLE);
      expect(tableChunk).toBeDefined();
      expect(tableChunk.metadata.caption).toBe('Tabelle 1: Liste der verfügbaren Funktionen');
      expect(tableChunk.chunkContent).toContain('useState');
    });

    test('should extract caption for images', () => {
      const html = `
        <div class="content">
          <figure>
            <img src="diagram.png" alt="Architecture diagram"/>
            <figcaption>Abbildung 1: System architecture overview</figcaption>
          </figure>
        </div>
      `;

      const chunks = chunker.processXHTML(html);
      
      const imageChunk = chunks.find(chunk => chunk.chunkType === CHUNK_TYPES.IMAGE);
      expect(imageChunk).toBeDefined();
      expect(imageChunk.metadata.caption).toBe('Abbildung 1: System architecture overview');
      expect(imageChunk.metadata.filename).toBe('diagram.png');
    });

    test('should handle code blocks without captions', () => {
      const html = `
        <div class="content">
          <div class="codelisting">
            <pre><code>const x = 42;</code></pre>
          </div>
        </div>
      `;

      const chunks = chunker.processXHTML(html);
      
      const codeChunk = chunks.find(chunk => chunk.chunkType === CHUNK_TYPES.CODE);
      expect(codeChunk).toBeDefined();
      expect(codeChunk.metadata.caption).toBe('');
      expect(codeChunk.chunkContent).toContain('const x = 42');
    });

    test('should handle caption preceding special element', () => {
      const html = `
        <div class="content">
          <p>Code 1: Example function</p>
          <pre>function example() { return true; }</pre>
        </div>
      `;

      const chunks = chunker.processXHTML(html);
      
      const codeChunk = chunks.find(chunk => chunk.chunkType === CHUNK_TYPES.CODE);
      expect(codeChunk).toBeDefined();
      expect(codeChunk.metadata.caption).toBe('Code 1: Example function');
      expect(codeChunk.chunkContent).toContain('function example()');
    });

    test('should handle caption following special element', () => {
      const html = `
        <div class="content">
          <table>
            <tr><td>Data</td></tr>
          </table>
          <p>Table 1: Data overview</p>
        </div>
      `;

      const chunks = chunker.processXHTML(html);
      
      const tableChunk = chunks.find(chunk => chunk.chunkType === CHUNK_TYPES.TABLE);
      expect(tableChunk).toBeDefined();
      expect(tableChunk.metadata.caption).toBe('Table 1: Data overview');
      expect(tableChunk.chunkContent).toContain('Data');
    });

    test('should handle caption nested inside container div', () => {
      const html = `
        <div class="content">
          <div class="codelisting">
            <p>Listing 1: Nested caption example</p>
            <pre><code>const nested = true;</code></pre>
          </div>
        </div>
      `;

      const chunks = chunker.processXHTML(html);
      
      const codeChunk = chunks.find(chunk => chunk.chunkType === CHUNK_TYPES.CODE);
      expect(codeChunk).toBeDefined();
      expect(codeChunk.metadata.caption).toBe('Listing 1: Nested caption example');
      expect(codeChunk.chunkContent).toContain('const nested = true');
    });
  });

  describe('Special Elements Detection', () => {
    test('should detect code blocks with pre tag', () => {
      const html = `
        <div class="content">
          <pre>const x = 1;</pre>
        </div>
      `;

      const chunks = chunker.processXHTML(html);
      const codeChunk = chunks.find(chunk => chunk.chunkType === CHUNK_TYPES.CODE);
      expect(codeChunk).toBeDefined();
      expect(codeChunk.chunkContent).toContain('const x = 1');
    });

    test('should detect code blocks with codelisting class', () => {
      const html = `
        <div class="content">
          <div class="codelisting">
            <pre><code>const y = 2;</code></pre>
          </div>
        </div>
      `;

      const chunks = chunker.processXHTML(html);
      const codeChunk = chunks.find(chunk => chunk.chunkType === CHUNK_TYPES.CODE);
      expect(codeChunk).toBeDefined();
      expect(codeChunk.chunkContent).toContain('const y = 2');
    });

    test('should detect images', () => {
      const html = `
        <div class="content">
          <img src="test.png" alt="Test image"/>
        </div>
      `;

      const chunks = chunker.processXHTML(html);
      const imageChunk = chunks.find(chunk => chunk.chunkType === CHUNK_TYPES.IMAGE);
      expect(imageChunk).toBeDefined();
      expect(imageChunk.metadata.filename).toBe('test.png');
    });

    test('should detect tables', () => {
      const html = `
        <div class="content">
          <table>
            <tr><td>Cell</td></tr>
          </table>
        </div>
      `;

      const chunks = chunker.processXHTML(html);
      const tableChunk = chunks.find(chunk => chunk.chunkType === CHUNK_TYPES.TABLE);
      expect(tableChunk).toBeDefined();
      expect(tableChunk.chunkContent).toContain('Cell');
    });
  });

  describe('Caption Pattern Recognition', () => {
    test('should recognize German listing caption patterns', () => {
      const testCases = [
        'Listing 9: Description',
        'Code 1: Example',
        'Beispiel 5: Test code',
        'Schema 3: Data structure'
      ];

      testCases.forEach(caption => {
        const html = `
          <div class="content">
            <p>${caption}</p>
            <pre>code here</pre>
          </div>
        `;
        
        const chunks = chunker.processXHTML(html);
        const codeChunk = chunks.find(chunk => chunk.chunkType === CHUNK_TYPES.CODE);
        expect(codeChunk).toBeDefined();
        expect(codeChunk.metadata.caption).toBe(caption);
      });
    });

    test('should recognize table caption patterns', () => {
      const testCases = [
        'Tabelle 1: Übersicht',
        'Table 2: Overview',
        'Tabel 3: Data'
      ];

      testCases.forEach(caption => {
        const html = `
          <div class="content">
            <p>${caption}</p>
            <table><tr><td>Data</td></tr></table>
          </div>
        `;
        
        const chunks = chunker.processXHTML(html);
        const tableChunk = chunks.find(chunk => chunk.chunkType === CHUNK_TYPES.TABLE);
        expect(tableChunk).toBeDefined();
        expect(tableChunk.metadata.caption).toBe(caption);
      });
    });

    test('should recognize figure caption patterns', () => {
      const testCases = [
        'Figure 1: Diagram',
        'Fig 2: Chart',
        'Abbildung 3: Grafik',
        'Bild 4: Photo'
      ];

      testCases.forEach(caption => {
        const html = `
          <div class="content">
            <p>${caption}</p>
            <img src="image.png" alt="Image"/>
          </div>
        `;
        
        const chunks = chunker.processXHTML(html);
        const imageChunk = chunks.find(chunk => chunk.chunkType === CHUNK_TYPES.IMAGE);
        expect(imageChunk).toBeDefined();
        expect(imageChunk.metadata.caption).toBe(caption);
      });
    });
  });
});
