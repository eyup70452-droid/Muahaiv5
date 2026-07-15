

export const file_read_tool = {
  id: "file_read_tool",
  description: "Reads the content of a file.",
  run: async (input: { path: string }) => {
    if (!input?.path) return { success: false, error: "Path is required" };
    const fs = await import('fs/promises');
    const path = await import('path');
    try {
      const fullPath = path.resolve(process.cwd(), input.path);
      if (!fullPath.startsWith(process.cwd())) {
        return { success: false, error: "Erişim reddedildi: Çalışma dizini sınırları dışına çıkılamaz." };
      }
      const content = await fs.readFile(fullPath, 'utf-8');
      return { success: true, path: input.path, updatedContent: content };
    } catch (e: any) {
      return { success: false, error: e.message, path: input.path };
    }
  }
};

export const file_write_tool = {
  id: "file_write_tool",
  description: "Writes content to a file (creates or overwrites). Sadece YENİ dosya oluşturmak için kullanın. Var olan dosyaları güncellemek için file_patch_tool tercih edin.",
  run: async (input: { path: string, content: string }) => {
    if (!input?.path) return { success: false, error: "Path is required" };
    const fs = await import('fs/promises');
    const path = await import('path');
    const fullPath = path.resolve(process.cwd(), input.path);
    if (!fullPath.startsWith(process.cwd())) {
      return { success: false, error: "Erişim reddedildi: Çalışma dizini sınırları dışına çıkılamaz." };
    }
    try {
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, input.content || '', 'utf-8');
      return { success: true, path: input.path, updatedContent: input.content };
    } catch (err: any) {
      return { success: false, error: `Dosya yazılamadı: ${err.message}`, path: input.path };
    }
  }
};

export const file_delete_tool = {
  id: "file_delete_tool",
  description: "Deletes a file.",
  run: async (input: { path: string }) => {
    if (!input?.path) return { success: false, error: "Path is required" };
    const fs = await import('fs/promises');
    const path = await import('path');
    const fullPath = path.resolve(process.cwd(), input.path);
    if (!fullPath.startsWith(process.cwd())) {
      return { success: false, error: "Erişim reddedildi: Çalışma dizini sınırları dışına çıkılamaz." };
    }
    try {
      await fs.unlink(fullPath);
      return { success: true, path: input.path };
    } catch (err: any) {
      return { success: false, error: `Dosya silinemedi: ${err.message}`, path: input.path };
    }
  }
};

export const file_query_tool = {
  id: "file_query_tool",
  description: "Parses PDF, DOCX, CSV or TXT files and searches for content.",
  run: async (input: { path: string, query: string }) => {
    if (!input?.path || !input?.query) return { success: false, error: "Path and query are required" };
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const ext = path.extname(input.path).toLowerCase();
      const fullPath = path.resolve(process.cwd(), input.path);
      if (!fullPath.startsWith(process.cwd())) {
        return { success: false, error: "Erişim reddedildi: Çalışma dizini sınırları dışına çıkılamaz." };
      }
      const buffer = await fs.readFile(fullPath);

      let text = "";
      if (ext === '.pdf') {
        const pdfParseModule = (await import('pdf-parse')) as any;
        const pdfParse = pdfParseModule.default || pdfParseModule;
        const data = await pdfParse(buffer);
        text = data.text;
      } else if (ext === '.docx') {
        const { extractRawText } = await import('mammoth');
        const docxData = await extractRawText({ buffer });
        text = docxData.value;
      } else if (ext === '.csv') {
        const { parse } = await import('papaparse');
        const csvText = buffer.toString('utf-8');
        const csvData = parse(csvText, { header: true, skipEmptyLines: true });
        text = JSON.stringify(csvData.data, null, 2);
      } else {
        text = buffer.toString('utf-8');
      }

      const queryTerms = input.query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
      const matches = text.split('\n\n').filter(chunk => {
        const lowerChunk = chunk.toLowerCase();
        return queryTerms.some(term => lowerChunk.includes(term));
      }).slice(0, 5);

      return {
        success: true,
        path: input.path,
        matches: matches,
        totalLength: text.length
      };
    } catch (e: any) {
      return { success: false, error: e.message, path: input.path };
    }
  }
};

export const zip_create_tool = {
  id: "zip_create_tool",
  description: "Creates a ZIP archive from a folder.",
  run: async (input: { folderPath: string, outputZip: string }) => {
    if (!input?.folderPath || !input?.outputZip) return { success: false, error: "folderPath and outputZip are required" };
    try {
      const path = await import('path');
      const AdmZip = (await import('adm-zip')).default;
      const folderFullPath = path.resolve(process.cwd(), input.folderPath);
      const outputFullPath = path.resolve(process.cwd(), input.outputZip);
      if (!folderFullPath.startsWith(process.cwd()) || !outputFullPath.startsWith(process.cwd())) {
        return { success: false, error: "Erişim reddedildi: Çalışma dizini sınırları dışına çıkılamaz." };
      }
      const zip = new AdmZip();
      zip.addLocalFolder(folderFullPath);
      zip.writeZip(outputFullPath);
      return { success: true, path: input.outputZip };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
};

export const zip_extract_tool = {
  id: "zip_extract_tool",
  description: "Extracts a ZIP archive to a folder.",
  run: async (input: { zipPath: string, outputFolder: string }) => {
    if (!input?.zipPath || !input?.outputFolder) return { success: false, error: "zipPath and outputFolder are required" };
    try {
      const path = await import('path');
      const AdmZip = (await import('adm-zip')).default;
      const zipFullPath = path.resolve(process.cwd(), input.zipPath);
      const outputFullPath = path.resolve(process.cwd(), input.outputFolder);
      if (!zipFullPath.startsWith(process.cwd()) || !outputFullPath.startsWith(process.cwd())) {
        return { success: false, error: "Erişim reddedildi: Çalışma dizini sınırları dışına çıkılamaz." };
      }
      const zip = new AdmZip(zipFullPath);
      zip.extractAllTo(outputFullPath, true);
      return { success: true, path: input.outputFolder };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
};

export const file_patch_tool = {
  id: "file_patch_tool",
  description: "Mevcut bir dosyada sadece belirli bir kısmı değiştirmek istediğinde kullan. Önce file_read_tool ile dosyayı oku, sonra değiştirmek istediğin tam metni 'search'e, yeni halini 'replace'e yaz. Tüm dosyayı yeniden yazmak yerine sadece değişen kısmı güncelle. Bu araç transactional ve global replace destekler.",
  run: async (input: { path: string, patches: { search: string, replace: string }[] }) => {
    if (!input?.path || !input?.patches || !Array.isArray(input.patches)) {
      return { success: false, error: "Path and patches array are required" };
    }
    const fs = await import('fs/promises');
    const path = await import('path');
    const fullPath = path.resolve(process.cwd(), input.path);
    if (!fullPath.startsWith(process.cwd())) {
      return { success: false, error: "Erişim reddedildi: Çalışma dizini sınırları dışına çıkılamaz." };
    }
    try {
      let content = await fs.readFile(fullPath, 'utf-8');
      
      // Phase 1: Validate all patches exist first (Transactional safety)
      for (const patch of input.patches) {
        if (!content.includes(patch.search)) {
           return { success: false, error: `Search string not found in file: ${patch.search.slice(0, 80)}...` };
        }
      }
      
      // Phase 2: Apply all patches using global replacement (split/join)
      for (const patch of input.patches) {
        content = content.split(patch.search).join(patch.replace);
      }
      
      await fs.writeFile(fullPath, content, 'utf-8');
      return { success: true, path: input.path, updatedContent: content };
    } catch (err: any) {
      return { success: false, error: `Dosya yamalanamadı: ${err.message}`, path: input.path };
    }
  }
};

export const file_analysis_tool = file_query_tool; // Alias for compatibility with planner

export const zip_analyze_tool = {
  id: "zip_analyze_tool",
  description: "Analyzes the contents of a ZIP file.",
  run: async (input: { zipPath: string }) => {
    if (!input?.zipPath) return { success: false, error: "zipPath is required" };
    try {
      const path = await import('path');
      const AdmZip = (await import('adm-zip')).default;
      const zipFullPath = path.resolve(process.cwd(), input.zipPath);
      if (!zipFullPath.startsWith(process.cwd())) {
        return { success: false, error: "Erişim reddedildi: Çalışma dizini sınırları dışına çıkılamaz." };
      }
      const zip = new AdmZip(zipFullPath);
      const zipEntries = zip.getEntries();
      const files = zipEntries.map(e => ({ name: e.entryName, size: e.header.size, isDirectory: e.isDirectory }));
      return { success: true, path: input.zipPath, files };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
};

export const project_scan_tool = {
  id: "project_scan_tool",
  description: "Reads directory tree returning structured data.",
  run: async (input: { path?: string }) => {
    const fs = await import('fs/promises');
    const path = await import('path');
    const targetPath = path.resolve(process.cwd(), input.path || ".");
    if (!targetPath.startsWith(process.cwd())) {
      return { success: false, error: "Erişim reddedildi: Çalışma dizini sınırları dışına çıkılamaz." };
    }
    const files: string[] = [];
    const folders: string[] = [];
    const scan = async (dir: string) => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
          const fullPath = path.join(dir, entry.name);
          const relPath = path.relative(targetPath, fullPath);
          if (entry.isDirectory()) {
            folders.push(relPath);
            await scan(fullPath);
          } else {
            files.push(relPath);
          }
        }
      } catch (e) {
        console.error(`Error scanning directory ${dir}:`, e);
      }
    };
    await scan(targetPath);
    return {
      success: true,
      path: targetPath,
      structure: { folders, files }
    };
  }
};

export const file_generator_tool = {
  id: "file_generator_tool",
  description: "Generates multiple files in the project.",
  run: async (input: { files: { path: string, content: string }[] }) => {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    if (!input?.files || !Array.isArray(input.files)) {
        return { success: false, error: "Files array is required" };
    }

    const results = [];
    for (const file of input.files) {
      try {
        const fullPath = path.resolve(process.cwd(), file.path);
        if (!fullPath.startsWith(process.cwd())) {
          results.push({ path: file.path, success: false, error: "Erişim reddedildi: Çalışma dizini sınırları dışına çıkılamaz." });
          continue;
        }
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, file.content || '', 'utf-8');
        results.push({ path: file.path, success: true });
      } catch (err: any) {
        results.push({ path: file.path, success: false, error: err.message });
      }
    }
    
    return { success: results.every(r => r.success), results };
  }
};
