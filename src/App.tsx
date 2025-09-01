import React, { useState, useEffect } from 'react';
import './App.css';

// 漢字からUnicodeコードポイントを取得
const getKanjiCode = (kanji: string): string => {
  const code = kanji.charCodeAt(0).toString(16).padStart(5, '0');
  return code;
};

// KanjiVGのSVGデータを取得
const fetchKanjiSVG = async (kanji: string): Promise<string | null> => {
  try {
    const code = getKanjiCode(kanji);
    const url = `https://cdn.jsdelivr.net/gh/KanjiVG/kanjivg/kanji/${code}.svg`;
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.text();
  } catch (error) {
    console.error('SVGの取得に失敗しました:', error);
    return null;
  }
};

// SVGを処理（書き順番号を表示/非表示）
const processKanjiSVG = (svgText: string, showNumbers: boolean): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, 'image/svg+xml');
  
  // ストロークのスタイル設定
  const strokes = doc.querySelectorAll('path[id^="kvg:"]');
  strokes.forEach((stroke) => {
    const path = stroke as SVGPathElement;
    path.setAttribute('stroke', '#000');
    path.setAttribute('stroke-width', '3');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
  });
  
  // StrokeNumbersグループの表示/非表示を制御
  const strokeNumbersGroup = doc.querySelector('g[id*="StrokeNumbers"]');
  if (strokeNumbersGroup) {
    if (showNumbers) {
      // 書き順番号を表示
      strokeNumbersGroup.setAttribute('style', 'fill:#666;font-size:8;font-family:sans-serif');
    } else {
      // 書き順番号を非表示
      strokeNumbersGroup.setAttribute('style', 'display:none');
    }
  }
  
  // viewBoxを正方形に調整
  const svg = doc.querySelector('svg');
  if (svg) {
    svg.setAttribute('viewBox', '0 0 109 109');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
  }
  
  return new XMLSerializer().serializeToString(doc);
};

interface KanjiDisplayProps {
  kanji: string;
  sizeMm: number;
  showNumbers: boolean;
}

const KanjiDisplay: React.FC<KanjiDisplayProps> = ({ kanji, sizeMm, showNumbers }) => {
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    const loadKanji = async () => {
      setLoading(true);
      const svg = await fetchKanjiSVG(kanji);
      if (svg) {
        const processed = processKanjiSVG(svg, showNumbers);
        setSvgContent(processed);
      } else {
        setSvgContent(null);
      }
      setLoading(false);
    };
    
    if (kanji) {
      loadKanji();
    }
  }, [kanji, showNumbers]);
  
  return (
    <div className="kanji-container" style={{ width: `${sizeMm}mm`, height: `${sizeMm}mm` }}>
      {/* 十字線（点線） */}
      <svg className="grid-lines" viewBox="0 0 100 100" style={{ width: '100%', height: '100%', position: 'absolute' }}>
        <line x1="50" y1="0" x2="50" y2="100" stroke="#ccc" strokeDasharray="2,2" />
        <line x1="0" y1="50" x2="100" y2="50" stroke="#ccc" strokeDasharray="2,2" />
      </svg>
      
      {/* 漢字SVG */}
      {loading && <div className="loading">読み込み中...</div>}
      {svgContent && (
        <div 
          className="kanji-svg"
          dangerouslySetInnerHTML={{ __html: svgContent }}
          style={{ width: '100%', height: '100%', position: 'relative' }}
        />
      )}
      {!loading && !svgContent && kanji && (
        <div className="error">漢字データが見つかりません</div>
      )}
    </div>
  );
};

function App() {
  const [inputText, setInputText] = useState(() => {
    // LocalStorageから読み込み
    return localStorage.getItem('kanjiInput') || '';
  });
  const [kanjiSizeMm, setKanjiSizeMm] = useState(() => {
    // LocalStorageから読み込み
    const saved = localStorage.getItem('kanjiSizeMm');
    return saved ? parseInt(saved, 10) : 20;
  });
  
  // 入力テキストの変更を監視してLocalStorageに保存
  useEffect(() => {
    localStorage.setItem('kanjiInput', inputText);
  }, [inputText]);
  
  // サイズの変更を監視してLocalStorageに保存
  useEffect(() => {
    localStorage.setItem('kanjiSizeMm', kanjiSizeMm.toString());
  }, [kanjiSizeMm]);
  
  // 入力テキストから漢字のみを抽出（行ごとに処理）
  const extractKanjiByLines = (text: string): string[][] => {
    const lines = text.split('\n');
    return lines.map(line => {
      const kanjiRegex = /[\u4e00-\u9faf\u3400-\u4dbf]/g;
      const matches = line.match(kanjiRegex);
      return matches ? matches : [];
    }).filter(line => line.length > 0); // 空行は除外
  };
  
  const kanjiLines = extractKanjiByLines(inputText);
  
  // A4サイズ（210mm × 297mm）を考慮した1行あたりの最大マス数を計算
  const maxKanjiPerRow = Math.floor(190 / kanjiSizeMm); // マージンを考慮
  
  // 改行を考慮したドリルレイアウトを作成
  const createDrillLayout = () => {
    const rows = [];
    let globalIndex = 0;
    
    kanjiLines.forEach((lineKanji, lineIndex) => {
      // 各行の漢字を最大幅で折り返し処理
      for (let i = 0; i < lineKanji.length; i += maxKanjiPerRow) {
        const kanjiInRow = lineKanji.slice(i, i + maxKanjiPerRow);
        
        // 番号付きの行
        const numberedRow = kanjiInRow.map((kanji, index) => (
          <KanjiDisplay 
            key={`${kanji}-${globalIndex + index}-numbered`} 
            kanji={kanji} 
            sizeMm={kanjiSizeMm} 
            showNumbers={true} 
          />
        ));
        
        // 番号なしの行
        const plainRow = kanjiInRow.map((kanji, index) => (
          <KanjiDisplay 
            key={`${kanji}-${globalIndex + index}-plain`} 
            kanji={kanji} 
            sizeMm={kanjiSizeMm} 
            showNumbers={false} 
          />
        ));
        
        rows.push(
          <div key={`line-${lineIndex}-row-${i}-numbered`} className="kanji-row">
            {numberedRow}
          </div>
        );
        rows.push(
          <div key={`line-${lineIndex}-row-${i}-plain`} className="kanji-row">
            {plainRow}
          </div>
        );
        
        globalIndex += kanjiInRow.length;
      }
      
      // 行間にスペースを追加（最後の行以外）
      if (lineIndex < kanjiLines.length - 1) {
        rows.push(
          <div key={`line-break-${lineIndex}`} className="line-break"></div>
        );
      }
    });
    
    return rows;
  };
  
  return (
    <div className="App">
      <header className="app-header">
        <h1>漢字書き順</h1>
        <p>美文字を書くために、正しい漢字の書き順を学びましょう</p>
      </header>
      
      <div className="controls no-print">
        <div className="input-section">
          <label htmlFor="kanji-input">漢字を入力：</label>
          <textarea
            id="kanji-input"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="例：漢字"
            className="kanji-input"
            rows={3}
          />
        </div>
        
        <div className="size-control">
          <label htmlFor="size-slider">マスサイズ：</label>
          <input
            id="size-slider"
            type="range"
            min="10"
            max="50"
            value={kanjiSizeMm}
            onChange={(e) => setKanjiSizeMm(Number(e.target.value))}
            className="size-slider"
          />
          <span>{kanjiSizeMm}mm</span>
        </div>
        
        <div className="print-control">
          <button 
            onClick={() => window.print()} 
            className="print-button"
            disabled={kanjiLines.length === 0}
          >
            印刷
          </button>
        </div>
      </div>
      
      {kanjiLines.length > 0 && (
        <div className="drill-container">
          {createDrillLayout()}
        </div>
      )}
    </div>
  );
}

export default App;