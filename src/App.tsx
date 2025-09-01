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

// SVGから書き順情報を抽出して処理
const processKanjiSVG = (svgText: string): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, 'image/svg+xml');
  
  // グループ要素を作成（番号を背面に配置するため）
  const g = doc.createElementNS('http://www.w3.org/2000/svg', 'g');
  const svg = doc.querySelector('svg');
  const strokesParent = doc.querySelector('g[id^="kvg:"]');
  
  // ストロークごとに番号を追加
  const strokes = doc.querySelectorAll('path[id^="kvg:"]');
  const numbers: Element[] = [];
  
  strokes.forEach((stroke, index) => {
    const path = stroke as SVGPathElement;
    // ストロークのスタイル設定
    path.setAttribute('stroke', '#000');
    path.setAttribute('stroke-width', '3');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    
    // 書き順番号を追加
    const pathData = path.getAttribute('d');
    if (pathData) {
      // パスの最初の座標を取得して番号を配置
      const match = pathData.match(/M\s*([0-9.]+)[,\s]+([0-9.]+)/);
      if (match) {
        const x = parseFloat(match[1]);
        const y = parseFloat(match[2]);
        
        // 番号の背景用の円を作成
        const circle = doc.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', x.toString());
        circle.setAttribute('cy', y.toString());
        circle.setAttribute('r', '8');
        circle.setAttribute('fill', 'white');
        circle.setAttribute('stroke', 'none');
        
        const text = doc.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', x.toString());
        text.setAttribute('y', (y + 4).toString());
        text.setAttribute('fill', '#ff0000');
        text.setAttribute('font-size', '12');
        text.setAttribute('font-weight', 'normal');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-family', 'sans-serif');
        text.textContent = (index + 1).toString();
        
        g.appendChild(circle);
        g.appendChild(text);
      }
    }
  });
  
  // SVGに番号グループを追加
  if (svg && strokesParent) {
    // 番号を最初に追加（背面に配置）
    svg.insertBefore(g, strokesParent);
  }
  
  // viewBoxを正方形に調整
  if (svg) {
    svg.setAttribute('viewBox', '0 0 109 109');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
  }
  
  return new XMLSerializer().serializeToString(doc);
};

interface KanjiDisplayProps {
  kanji: string;
  size: number;
}

const KanjiDisplay: React.FC<KanjiDisplayProps> = ({ kanji, size }) => {
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    const loadKanji = async () => {
      setLoading(true);
      const svg = await fetchKanjiSVG(kanji);
      if (svg) {
        const processed = processKanjiSVG(svg);
        setSvgContent(processed);
      } else {
        setSvgContent(null);
      }
      setLoading(false);
    };
    
    if (kanji) {
      loadKanji();
    }
  }, [kanji]);
  
  return (
    <div className="kanji-container" style={{ width: size, height: size }}>
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
  const [inputText, setInputText] = useState('');
  const [kanjiSize, setKanjiSize] = useState(200);
  
  // 入力テキストから漢字のみを抽出
  const extractKanji = (text: string): string[] => {
    const kanjiRegex = /[\u4e00-\u9faf\u3400-\u4dbf]/g;
    const matches = text.match(kanjiRegex);
    return matches ? matches : [];
  };
  
  const kanjiList = extractKanji(inputText);
  
  return (
    <div className="App">
      <header className="app-header">
        <h1>漢字書き順</h1>
        <p>美文字を書くために、正しい漢字の書き順を学びましょう</p>
      </header>
      
      <div className="controls no-print">
        <div className="input-section">
          <label htmlFor="kanji-input">漢字を入力：</label>
          <input
            id="kanji-input"
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="例：漢字"
            className="kanji-input"
          />
        </div>
        
        <div className="size-control">
          <label htmlFor="size-slider">表示サイズ：</label>
          <input
            id="size-slider"
            type="range"
            min="100"
            max="400"
            value={kanjiSize}
            onChange={(e) => setKanjiSize(Number(e.target.value))}
            className="size-slider"
          />
          <span>{kanjiSize}px</span>
        </div>
      </div>
      
      <div className="kanji-grid">
        {kanjiList.map((kanji, index) => (
          <KanjiDisplay key={`${kanji}-${index}`} kanji={kanji} size={kanjiSize} />
        ))}
      </div>
    </div>
  );
}

export default App;