/**
 * Database Write Restrictions Test
 * Ensures code NEVER writes to pieceOfContents, Article, or PocEmbedding collections
 */

const fs = require('fs');
const path = require('path');

describe('Database Write Restrictions', () => {
  const FORBIDDEN_WRITE_PATTERNS = [
    /PieceOfContent\s*\.\s*(create|save|insertMany|insertOne|updateOne|updateMany|findOneAndUpdate|findByIdAndUpdate|replaceOne|deleteMany|deleteOne)/,
    /Article\s*\.\s*(create|save|insertMany|insertOne|updateOne|updateMany|findOneAndUpdate|findByIdAndUpdate|replaceOne|deleteMany|deleteOne)/,
    /PocEmbedding\s*\.\s*(create|save|insertMany|insertOne|updateOne|updateMany|findOneAndUpdate|findByIdAndUpdate|replaceOne|deleteMany|deleteOne)/,
    /pieceOfContents\s*\.\s*(create|save|insertMany|insertOne|updateOne|updateMany|findOneAndUpdate|findByIdAndUpdate|replaceOne|deleteMany|deleteOne)/
  ];

  /**
   * Recursively find all JavaScript files in a directory
   */
  function findJsFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        // Skip node_modules, tests, coverage
        if (!['node_modules', 'tests', 'coverage', '.git'].includes(file)) {
          findJsFiles(filePath, fileList);
        }
      } else if (file.endsWith('.js')) {
        fileList.push(filePath);
      }
    });

    return fileList;
  }

  /**
   * Scan a file for forbidden write operations
   */
  function scanFileForForbiddenWrites(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const violations = [];

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      // Skip comments
      if (trimmedLine.startsWith('//') || trimmedLine.startsWith('*') || trimmedLine.startsWith('/*')) {
        return;
      }

      // Check for forbidden write patterns
      FORBIDDEN_WRITE_PATTERNS.forEach(pattern => {
        if (pattern.test(line)) {
          violations.push({
            file: filePath,
            line: index + 1,
            code: trimmedLine,
            pattern: pattern.toString()
          });
        }
      });
    });

    return violations;
  }

  describe('Forbidden Collection Write Verification', () => {
    let srcFiles;
    let allViolations;

    beforeAll(() => {
      const srcDir = path.join(__dirname, '../../src');
      srcFiles = findJsFiles(srcDir);
      
      allViolations = [];
      srcFiles.forEach(file => {
        const violations = scanFileForForbiddenWrites(file);
        allViolations.push(...violations);
      });
    });

    test('should find source files in src directory', () => {
      expect(srcFiles.length).toBeGreaterThan(0);
      expect(srcFiles.every(f => f.includes('/src/'))).toBe(true);
    });

    test('should NEVER write to PieceOfContent collection', () => {
      const pieceOfContentWrites = allViolations.filter(v => 
        v.code.includes('PieceOfContent')
      );

      if (pieceOfContentWrites.length > 0) {
        const violations = pieceOfContentWrites.map(w => 
          `${path.relative(path.join(__dirname, '../../'), w.file)}:${w.line} - ${w.code}`
        ).join('\n');
        
        fail(`Found ${pieceOfContentWrites.length} write operation(s) to PieceOfContent collection:\n${violations}`);
      }

      expect(pieceOfContentWrites).toHaveLength(0);
    });

    test('should NEVER write to Article collection', () => {
      const articleWrites = allViolations.filter(v => 
        v.code.includes('Article.')
      );

      if (articleWrites.length > 0) {
        const violations = articleWrites.map(w => 
          `${path.relative(path.join(__dirname, '../../'), w.file)}:${w.line} - ${w.code}`
        ).join('\n');
        
        fail(`Found ${articleWrites.length} write operation(s) to Article collection:\n${violations}`);
      }

      expect(articleWrites).toHaveLength(0);
    });

    test('should NEVER write to PocEmbedding collection', () => {
      const embeddingWrites = allViolations.filter(v => 
        v.code.includes('PocEmbedding')
      );

      if (embeddingWrites.length > 0) {
        const violations = embeddingWrites.map(w => 
          `${path.relative(path.join(__dirname, '../../'), w.file)}:${w.line} - ${w.code}`
        ).join('\n');
        
        fail(`Found ${embeddingWrites.length} write operation(s) to PocEmbedding collection:\n${violations}`);
      }

      expect(embeddingWrites).toHaveLength(0);
    });

    test('should have ZERO violations across all forbidden collections', () => {
      if (allViolations.length > 0) {
        const violations = allViolations.map(w => 
          `${path.relative(path.join(__dirname, '../../'), w.file)}:${w.line} - ${w.code}`
        ).join('\n');
        
        fail(`Found ${allViolations.length} total write violation(s) to forbidden collections:\n${violations}`);
      }

      expect(allViolations).toHaveLength(0);
    });

    test('should log summary of scan results', () => {
      console.log('\n=== Forbidden Write Operations Scan ===');
      console.log(`Scanned ${srcFiles.length} files`);
      console.log(`Found ${allViolations.length} violations`);
      
      if (allViolations.length > 0) {
        console.log('\nViolations:');
        allViolations.forEach(v => {
          console.log(`  - ${path.relative(path.join(__dirname, '../../'), v.file)}:${v.line}`);
          console.log(`    ${v.code}`);
        });
      } else {
        console.log('✅ No writes to forbidden collections detected');
      }
      console.log('========================================\n');
      
      expect(true).toBe(true); // Always pass, this is just for logging
    });
  });


});
