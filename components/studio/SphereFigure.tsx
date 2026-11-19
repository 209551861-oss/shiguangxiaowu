/**
 * 球体五大调子示意图（内联 SVG）
 * 与本地「绘画学院」教材同源，避免额外图片依赖，缩放不失真。
 */
export default function SphereFigure() {
  return (
    <figure className="my-6 overflow-hidden rounded-2xl border border-line bg-paper shadow-soft">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 560 330"
        role="img"
        aria-label="左上光源下的球体五大调子示意"
        className="block h-auto w-full"
      >
        <defs>
          <radialGradient id="sph" cx="34%" cy="28%" r="74%">
            <stop offset="0%" stopColor="#fdfbf5" />
            <stop offset="34%" stopColor="#ece5d7" />
            <stop offset="62%" stopColor="#b9b1a0" />
            <stop offset="84%" stopColor="#6f6a5f" />
            <stop offset="100%" stopColor="#4a4640" />
          </radialGradient>
          <linearGradient id="cast" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#8d8778" stopOpacity=".55" />
            <stop offset="70%" stopColor="#cfc7b7" stopOpacity=".2" />
            <stop offset="100%" stopColor="#cfc7b7" stopOpacity="0" />
          </linearGradient>
          <marker
            id="ar"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M0 0L10 5L0 10z" fill="#a94f36" />
          </marker>
        </defs>

        <rect x="0" y="0" width="560" height="330" fill="#fcfaf4" />
        <line x1="40" y1="262" x2="520" y2="262" stroke="#ded6c6" strokeWidth="1.5" />

        {/* 投影：方向与光源相反，近端实、远端虚 */}
        <ellipse cx="372" cy="266" rx="118" ry="19" fill="url(#cast)" />
        <ellipse cx="344" cy="266" rx="62" ry="13" fill="#a9a294" opacity=".45" />

        {/* 球体 */}
        <circle cx="268" cy="164" r="94" fill="url(#sph)" />

        {/* 明暗交界线 */}
        <path
          d="M330 88 C 372 122, 372 206, 316 240"
          fill="none"
          stroke="#5c574d"
          strokeWidth="1.6"
          strokeDasharray="5 4"
          opacity=".85"
        />

        {/* 反光：暗部里的窄亮带 */}
        <path
          d="M306 232 C 328 220, 340 200, 344 178"
          fill="none"
          stroke="#efe8da"
          strokeWidth="7"
          opacity=".28"
          strokeLinecap="round"
        />

        {/* 高光 */}
        <ellipse
          cx="222"
          cy="124"
          rx="15"
          ry="11"
          fill="#fffdf6"
          opacity=".92"
          transform="rotate(-24 222 124)"
        />

        {/* 光方向 */}
        <line
          x1="78"
          y1="46"
          x2="158"
          y2="86"
          stroke="#a94f36"
          strokeWidth="1.6"
          markerEnd="url(#ar)"
        />
        <text x="60" y="38" fontFamily="ui-monospace, monospace" fontSize="11" fill="#a94f36">
          光
        </text>

        {/* 标注 */}
        <g fontFamily="'PingFang SC', 'Noto Sans SC', sans-serif" fontSize="11.5" fill="#6f6759">
          <line x1="186" y1="112" x2="112" y2="84" stroke="#cfc7b7" />
          <text x="44" y="80">高光</text>
          <line x1="196" y1="196" x2="104" y2="206" stroke="#cfc7b7" />
          <text x="46" y="210">亮部</text>
          <line x1="352" y1="150" x2="446" y2="132" stroke="#cfc7b7" />
          <text x="450" y="136">明暗交界线</text>
          <line x1="330" y1="222" x2="418" y2="238" stroke="#cfc7b7" />
          <text x="422" y="242">反光</text>
          <line x1="372" y1="278" x2="432" y2="300" stroke="#cfc7b7" />
          <text x="436" y="304">投影</text>
        </g>
      </svg>
    </figure>
  );
}
