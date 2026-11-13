/** 经纬度（度）→ 平面坐标 */
export type Projection = (longitude: number, latitude: number) => [x: number, y: number];

const A1 = 1.340264;
const A2 = -0.081106;
const A3 = 0.000893;
const A4 = 0.003796;
const M = Math.sqrt(3) / 2;

/**
 * Equal Earth 投影（Šavrič、Patterson、Jenny，2018）：等面积，各大洲的大小比例是对的，形状也不太别扭。
 * 等面积对我们有用：地区在图上的面积就正比于真实面积。输出的 x 约在 ±2.71、y 约在 ±1.32，北在上。
 */
export const equalEarth: Projection = (longitude, latitude) => {
  const lambda = (longitude * Math.PI) / 180;
  const theta = Math.asin(M * Math.sin((latitude * Math.PI) / 180));
  const theta2 = theta * theta;
  const theta6 = theta2 * theta2 * theta2;
  const x =
    (lambda * Math.cos(theta)) / (M * (A1 + 3 * A2 * theta2 + theta6 * (7 * A3 + 9 * A4 * theta2)));
  const y = theta * (A1 + A2 * theta2 + theta6 * (A3 + A4 * theta2));
  return [x, y];
};

/**
 * 米勒圆柱投影：经线竖直、纬线水平，整张图是个矩形——游戏里常见的那种“平的”世界地图。
 * 高纬度会被放大（不如墨卡托夸张），所以面积不能从图上量。输出的 x 在 ±π、y 在 80°N 约 1.95、55°S 约 -1.05。
 */
export const miller: Projection = (longitude, latitude) => [
  (longitude * Math.PI) / 180,
  1.25 * Math.log(Math.tan(Math.PI / 4 + (0.4 * latitude * Math.PI) / 180)),
];
