/**
 * 试验场的入口。地址里：mode=view（自己画，默认）或 dom（网页元素）；rows=行数（默认 2000）。
 */
import { createApp } from 'vue';
import { load } from './data';
import { Lab, type LabMode } from './Lab';

const query = new URLSearchParams(location.search);
const mode: LabMode = query.get('mode') === 'dom' ? 'dom' : 'view';
const rows = Math.max(1, Number(query.get('rows')) || 2000);

load(rows);
createApp(Lab, { mode, rows }).mount('#app');
