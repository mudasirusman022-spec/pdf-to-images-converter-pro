
import React, { useState, useCallback, useRef } from 'react';
import { 
  FileUp, 
  Image as ImageIcon, 
  Download, 
  RefreshCw, 
  FileWarning,
  CheckCircle2,
  Loader2,
  Archive
} from 'lucide-react';
import { AppStatus, ConvertedImage, ConversionStats } from './types';

// PDF.js global configuration
declare const pdfjsLib: any;
declare const JSZip: any;

const App: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [images, setImages] = useState<ConvertedImage[]>([]);
  const [stats, setStats] = useState<ConversionStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processPdf = async (file: File) => {
    try {
      setStatus(AppStatus.PROCESSING);
      setError(null);
      setImages([]);
      
      const arrayBuffer = await file.arrayBuffer();
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      
      setStats({
        totalPages: pdf.numPages,
        processedPages: 0,
        fileName: file.name,
        fileSize: file.size
      });

      const converted: ConvertedImage[] = [];
      const scale = 2.77; // Approx 200 DPI (72 * 2.77)

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale });
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Could not create canvas context');

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({
          canvasContext: context,
          viewport: viewport
        }).promise;

        const dataUrl = canvas.toDataURL('image/png', 1.0);
        
        // Convert dataURL to Blob for ZIP generation
        const response = await fetch(dataUrl);
        const blob = await response.blob();

        const imgData: ConvertedImage = {
          id: `page-${i}-${Date.now()}`,
          pageNumber: i,
          dataUrl,
          blob
        };

        converted.push(imgData);
        setImages(prev => [...prev, imgData]);
        setStats(prev => prev ? { ...prev, processedPages: i } : null);
      }

      setStatus(AppStatus.COMPLETED);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to process PDF file. Please ensure it is a valid document.');
      setStatus(AppStatus.ERROR);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        setError('Please upload a valid PDF file.');
        return;
      }
      processPdf(file);
    }
  };

  const handleDownloadAll = async () => {
    if (!images.length || !stats) return;
    
    const zip = new JSZip();
    const folderName = stats.fileName.replace('.pdf', '');
    const imgFolder = zip.folder(folderName);

    images.forEach((img) => {
      imgFolder.file(`page_${img.pageNumber}.png`, img.blob);
    });

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${folderName}_images.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setStatus(AppStatus.IDLE);
    setImages([]);
    setStats(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 flex flex-col min-h-screen">
      <header className="text-center mb-12">
        <div className="flex items-center justify-center mb-4">
          <div className="bg-blue-600 p-3 rounded-2xl shadow-lg shadow-blue-200">
            <ImageIcon className="text-white w-8 h-8" />
          </div>
        </div>
        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight sm:text-5xl">
          PDF to Images
        </h1>
        <p className="mt-3 text-lg text-gray-500">
          Convert your PDF pages into high-resolution PNG images instantly.
        </p>
      </header>

      <main className="flex-grow flex flex-col items-center">
        {status === AppStatus.IDLE && (
          <div className="w-full max-w-2xl">
            <label 
              className="relative group block w-full border-2 border-dashed border-gray-300 rounded-3xl p-12 text-center hover:border-blue-500 hover:bg-blue-50 transition-all cursor-pointer bg-white shadow-sm"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) processPdf(file);
              }}
            >
              <input 
                type="file" 
                className="hidden" 
                accept=".pdf"
                ref={fileInputRef}
                onChange={handleFileChange}
              />
              <div className="flex flex-col items-center">
                <div className="mb-4 p-4 bg-gray-100 rounded-full group-hover:bg-blue-100 transition-colors">
                  <FileUp className="w-12 h-12 text-gray-400 group-hover:text-blue-600" />
                </div>
                <span className="text-xl font-semibold text-gray-700">Click to upload or drag & drop</span>
                <span className="text-sm text-gray-500 mt-2">PDF files up to 50MB</span>
              </div>
            </label>
            
            {error && (
              <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700 animate-in fade-in slide-in-from-top-2">
                <FileWarning className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <p>{error}</p>
              </div>
            )}
          </div>
        )}

        {status === AppStatus.PROCESSING && stats && (
          <div className="w-full max-w-lg bg-white rounded-3xl p-8 shadow-xl border border-gray-100">
            <div className="flex flex-col items-center">
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-6" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Processing Document</h2>
              <p className="text-gray-500 mb-8 text-center">{stats.fileName}</p>
              
              <div className="w-full bg-gray-100 rounded-full h-3 mb-4 overflow-hidden">
                <div 
                  className="bg-blue-600 h-full transition-all duration-300 ease-out"
                  style={{ width: `${(stats.processedPages / stats.totalPages) * 100}%` }}
                />
              </div>
              
              <div className="flex justify-between w-full text-sm font-medium text-gray-600">
                <span>Converting page {stats.processedPages}</span>
                <span>{stats.totalPages} pages total</span>
              </div>
            </div>
          </div>
        )}

        {status === AppStatus.COMPLETED && stats && (
          <div className="w-full">
            <div className="bg-white rounded-3xl p-6 shadow-md border border-gray-100 mb-8 flex flex-col md:flex-row items-center justify-between gap-6 sticky top-4 z-10">
              <div className="flex items-center gap-4">
                <div className="bg-green-100 p-2 rounded-full">
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{stats.fileName}</h3>
                  <p className="text-sm text-gray-500">{stats.totalPages} pages converted successfully</p>
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-3">
                <button 
                  onClick={handleDownloadAll}
                  className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
                >
                  <Archive className="w-5 h-5" />
                  Download All as ZIP
                </button>
                <button 
                  onClick={reset}
                  className="flex items-center gap-2 bg-gray-100 text-gray-700 px-6 py-2.5 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
                >
                  <RefreshCw className="w-5 h-5" />
                  Convert Another
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {images.map((img) => (
                <div key={img.id} className="group bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="aspect-[3/4] overflow-hidden bg-gray-50 relative">
                    <img 
                      src={img.dataUrl} 
                      alt={`Page ${img.pageNumber}`} 
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                       <a 
                        href={img.dataUrl} 
                        download={`page_${img.pageNumber}.png`}
                        className="bg-white p-3 rounded-full hover:bg-gray-100 transform scale-90 group-hover:scale-100 transition-transform"
                        title="Download Image"
                      >
                        <Download className="w-6 h-6 text-gray-900" />
                      </a>
                    </div>
                  </div>
                  <div className="p-4 flex items-center justify-between bg-white border-t border-gray-100">
                    <span className="font-medium text-gray-700">Page {img.pageNumber}</span>
                    <a 
                      href={img.dataUrl} 
                      download={`page_${img.pageNumber}.png`}
                      className="text-blue-600 hover:text-blue-800 text-sm font-semibold flex items-center gap-1"
                    >
                      Download
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className="mt-16 py-8 border-t border-gray-200 text-center text-gray-500 text-sm">
        <p>&copy; {new Date().getFullYear()} PDF to Images Converter Pro. High-quality client-side processing.</p>
      </footer>
    </div>
  );
};

export default App;
