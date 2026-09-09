"use client";

/**
 * 「假二维码」——支付还没接通之前，充值弹窗里垫在按钮下面的占位图（全站唯一实现）。
 *
 * ⭐ 为什么单独一个文件：积分充值页（已上线）和会员充值页（暂时下架、代码保留）都要用它。
 *   如果继续从 `membership-modal.tsx` 里 import，会员页那一整坨（档位、价格、权益对比表）
 *   就会跟着被打进生产前端包 —— 而会员现在是"保留但隐藏"，不该出现在用户能拿到的 JS 里。
 * ⛔ 接通真支付后这个组件要被真二维码替换，别把它当成正式资产。
 */
export function FakePayQrCode() {
  const size = 29;
  const cells: boolean[][] = Array.from({ length: size }, () => Array.from({ length: size }, () => false));
  const reserved: boolean[][] = Array.from({ length: size }, () => Array.from({ length: size }, () => false));
  const setCell = (x: number, y: number, on = true) => {
    if (x >= 0 && x < size && y >= 0 && y < size) cells[y][x] = on;
  };
  const reserve = (x: number, y: number) => {
    if (x >= 0 && x < size && y >= 0 && y < size) reserved[y][x] = true;
  };
  const drawFinder = (ox: number, oy: number) => {
    for (let y = -1; y < 8; y += 1) {
      for (let x = -1; x < 8; x += 1) {
        reserve(ox + x, oy + y);
        const inCore = x >= 0 && x <= 6 && y >= 0 && y <= 6;
        if (!inCore) continue;
        const edge = x === 0 || y === 0 || x === 6 || y === 6;
        const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        setCell(ox + x, oy + y, edge || core);
      }
    }
  };
  drawFinder(0, 0);
  drawFinder(size - 7, 0);
  drawFinder(0, size - 7);
  const pattern = [
    "10100011010110010",
    "01011100101001101",
    "10001010110100110",
    "01110101001011001",
    "11000110011101010",
    "00111001100010111",
    "10110100011010001",
    "01001011100101110",
    "11100001010110100",
    "00011110101001011",
    "10010011000111010",
    "01101100111000101",
    "11011010001101001",
    "00100101110010110",
    "10101000101110011",
    "01010111010001100",
    "11101101000110010",
    "00010010111001101",
    "01100011101010100",
    "10011100010101011",
    "01000110110011101",
  ];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (reserved[y][x]) continue;
      const row = pattern[(y * 3 + x) % pattern.length];
      setCell(x, y, row[(x * 5 + y * 2) % row.length] === "1");
    }
  }
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full blur-[5px] opacity-[0.22]">
      <rect width={size} height={size} fill="#fff" />
      {cells.flatMap((row, y) => row.map((on, x) => (on ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#111" /> : null)))}
    </svg>
  );
}
