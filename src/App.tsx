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
  
  const containerStyle = {
    width: `${sizeMm}mm`,
    height: `${sizeMm}mm`,
    minWidth: `${sizeMm}mm`,
    maxWidth: `${sizeMm}mm`,
    minHeight: `${sizeMm}mm`,
    maxHeight: `${sizeMm}mm`,
    flex: 'none'
  };

  return (
    <div className="kanji-container" style={containerStyle}>
      {/* 十字線（点線） */}
      <svg className="grid-lines" viewBox="0 0 100 100" style={{ width: '100%', height: '100%', position: 'absolute' }}>
        <line x1="50" y1="0" x2="50" y2="100" stroke="#666" strokeDasharray="2,2" />
        <line x1="0" y1="50" x2="100" y2="50" stroke="#666" strokeDasharray="2,2" />
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
  const [removeDuplicates, setRemoveDuplicates] = useState(() => {
    // LocalStorageから読み込み
    const saved = localStorage.getItem('removeDuplicates');
    return saved ? JSON.parse(saved) : true; // デフォルトは重複削除ON
  });
  const [sortOrder, setSortOrder] = useState(() => {
    // LocalStorageから読み込み
    return localStorage.getItem('sortOrder') || 'none'; // なし, stroke-asc, stroke-desc, unicode-asc, unicode-desc
  });
  
  // 入力テキストの変更を監視してLocalStorageに保存
  useEffect(() => {
    localStorage.setItem('kanjiInput', inputText);
  }, [inputText]);
  
  // サイズの変更を監視してLocalStorageに保存
  useEffect(() => {
    localStorage.setItem('kanjiSizeMm', kanjiSizeMm.toString());
  }, [kanjiSizeMm]);
  
  // 重複削除設定の変更を監視してLocalStorageに保存
  useEffect(() => {
    localStorage.setItem('removeDuplicates', JSON.stringify(removeDuplicates));
  }, [removeDuplicates]);
  
  // ソート設定の変更を監視してLocalStorageに保存
  useEffect(() => {
    localStorage.setItem('sortOrder', sortOrder);
  }, [sortOrder]);
  
  // KanjiVGのSVGデータから実際の画数を取得
  const getStrokeCountFromKanjiVG = async (kanji: string): Promise<number> => {
    try {
      const svg = await fetchKanjiSVG(kanji);
      if (svg) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(svg, 'image/svg+xml');
        const strokes = doc.querySelectorAll('path[id^="kvg:"]');
        return strokes.length;
      }
    } catch (error) {
      console.error('画数取得エラー:', error);
    }
    return 10; // デフォルト
  };

  // 漢字の画数キャッシュ
  const [strokeCache, setStrokeCache] = useState<Map<string, number>>(new Map());

  // 入力テキストから漢字のみを抽出（行ごとに処理）
  const extractKanjiByLines = (text: string): string[][] => {
    const lines = text.split('\n');
    return lines.map(line => {
      const kanjiRegex = /[\u4e00-\u9faf\u3400-\u4dbf]/g;
      const matches = line.match(kanjiRegex);
      
      if (!matches) {
        return [];
      }
      
      if (removeDuplicates) {
        // 重複削除：各行内で重複を削除
        return [...new Set(matches)];
      }
      
      return matches;
    }).filter(line => line.length > 0); // 空行は除外
  };

  // ソート用の非同期関数
  const sortKanji = async (kanjiList: string[][]): Promise<string[][]> => {
    if (sortOrder === 'none') return kanjiList;

    const sortedLines = await Promise.all(
      kanjiList.map(async (lineKanji) => {
        if (sortOrder.startsWith('stroke-')) {
          // 画数順ソート
          const kanjiWithStrokes = await Promise.all(
            lineKanji.map(async (kanji) => {
              // キャッシュから取得を試行
              let strokeCount = strokeCache.get(kanji);
              if (strokeCount === undefined) {
                strokeCount = await getStrokeCountFromKanjiVG(kanji);
                // キャッシュに保存
                setStrokeCache(prev => new Map(prev.set(kanji, strokeCount!)));
              }
              return { kanji, strokeCount };
            })
          );

          // 画数順でソート
          kanjiWithStrokes.sort((a, b) => 
            sortOrder === 'stroke-asc' 
              ? a.strokeCount - b.strokeCount 
              : b.strokeCount - a.strokeCount
          );

          return kanjiWithStrokes.map(item => item.kanji);
        } else if (sortOrder.startsWith('unicode-')) {
          // Unicode順ソート
          const kanjiWithUnicode = lineKanji.map(kanji => ({
            kanji,
            unicode: kanji.charCodeAt(0)
          }));

          kanjiWithUnicode.sort((a, b) => 
            sortOrder === 'unicode-asc' 
              ? a.unicode - b.unicode 
              : b.unicode - a.unicode
          );

          return kanjiWithUnicode.map(item => item.kanji);
        }

        return lineKanji;
      })
    );

    return sortedLines;
  };
  
  const [sortedKanjiLines, setSortedKanjiLines] = useState<string[][]>([]);

  // 漢字リストをソート
  useEffect(() => {
    const processKanji = async () => {
      const rawKanjiLines = extractKanjiByLines(inputText);
      const sorted = await sortKanji(rawKanjiLines);
      setSortedKanjiLines(sorted);
    };
    
    processKanji();
  }, [inputText, removeDuplicates, sortOrder, strokeCache]);

  const kanjiLines = sortedKanjiLines;
  
  // A4サイズ（210mm × 297mm）を考慮した1行あたりの最大マス数を計算
  const maxKanjiPerRow = Math.floor(190 / kanjiSizeMm); // マージンを考慮
  
  // 改行を考慮したドリルレイアウトを作成
  const createDrillLayout = (): React.ReactElement[] => {
    const rows: React.ReactElement[] = [];
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
          <div key={`line-${lineIndex}-row-${i}-pair`} className="kanji-pair">
            <div className="kanji-row">
              {numberedRow}
            </div>
            <div className="kanji-row">
              {plainRow}
            </div>
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
          <label htmlFor="size-input">マスサイズ：</label>
          <input
            id="size-input"
            type="number"
            min="10"
            max="100"
            value={kanjiSizeMm}
            onChange={(e) => setKanjiSizeMm(Number(e.target.value))}
            className="size-input"
          />
          <span>mm</span>
        </div>
        
        <div className="options-control">
          <label>
            <input
              type="checkbox"
              checked={removeDuplicates}
              onChange={(e) => setRemoveDuplicates(e.target.checked)}
            />
            重複削除
          </label>
        </div>
        
        <div className="sort-control">
          <label htmlFor="sort-order">表示順：</label>
          <select
            id="sort-order"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="sort-order-select"
          >
            <option value="none">なし</option>
            <option value="stroke-asc">画数順（昇順）</option>
            <option value="stroke-desc">画数順（降順）</option>
            <option value="unicode-asc">Unicode順（昇順）</option>
            <option value="unicode-desc">Unicode順（降順）</option>
          </select>
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