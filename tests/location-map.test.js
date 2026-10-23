'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createPage } = require('./helpers/browser');

const page = () => createPage('location-map/index.html');
const ANDROID = { semanticSegments: [
  { startTime: '2025-03-01T08:00:00.000+05:30', endTime: '2025-03-01T18:00:00.000+05:30', visit: { topCandidate: { placeId: 'W', semanticType: 'INFERRED_WORK', placeLocation: { latLng: '12.9716°, 77.5946°' } } } },
  { startTime: '2025-03-01T18:00:00.000+05:30', endTime: '2025-03-01T18:40:00.000+05:30', activity: { start: { latLng: '12.9716°, 77.5946°' }, end: { latLng: '12.9352°, 77.6245°' }, distanceMeters: 6200, topCandidate: { type: 'IN_PASSENGER_VEHICLE' } } },
  { startTime: '2025-03-01T18:40:00.000+05:30', endTime: '2025-03-02T08:00:00.000+05:30', visit: { topCandidate: { placeId: 'H', semanticType: 'INFERRED_HOME', placeLocation: { latLng: '12.9352°, 77.6245°' } } } },
  { startTime: '2025-03-01T18:00:00.000+05:30', endTime: '2025-03-01T18:40:00.000+05:30', timelinePath: [{ point: '12.95°, 77.61°', time: '2025-03-01T18:20:00.000+05:30' }] },
], rawSignals: [{ position: { LatLng: '12.9°, 77.6°', timestamp: '2025-03-02T09:00:00.000+05:30' } }] };
const IOS = [
  { startTime: '2024-12-24T10:00:00.000+05:30', endTime: '2024-12-24T12:00:00.000+05:30', visit: { topCandidate: { placeLocation: 'geo:15.5527,73.7517', placeID: 'G', semanticType: 'Unknown' } } },
  { startTime: '2024-12-24T12:00:00.000+05:30', endTime: '2024-12-24T13:00:00.000+05:30', activity: { start: 'geo:15.5527,73.7517', end: 'geo:15.4989,73.8278', distanceMeters: '9800.5', topCandidate: { type: 'walking' } } },
];
const SEMANTIC = { timelineObjects: [
  { placeVisit: { location: { latitudeE7: 189220000, longitudeE7: 728347000, placeId: 'P', name: 'Gateway of India', address: 'Apollo Bandar, Mumbai' }, duration: { startTimestamp: '2019-05-01T10:00:00Z', endTimestamp: '2019-05-01T11:30:00Z' } } },
  { activitySegment: { startLocation: { latitudeE7: 189220000, longitudeE7: 728347000 }, endLocation: { latitudeE7: 190760000, longitudeE7: 728777000 }, duration: { startTimestamp: '2019-05-01T11:30:00Z' }, distance: 17500, activityType: 'IN_TRAIN' } },
] };
const RECORDS = { locations: [{ latitudeE7: 285000000, longitudeE7: 772000000, accuracy: 10, timestamp: '2016-01-01T10:00:00Z' }, { latitudeE7: 285100000, longitudeE7: 772100000, timestampMs: '1451642400000' }] };

test('all four export formats: Android, iPhone, monthly Takeout files and Records.json', () => {
  const p = page();
  p.sandbox.J = JSON.stringify([ANDROID, IOS, SEMANTIC, RECORDS]);
  const o = JSON.parse(p.run(`(() => { for (const j of JSON.parse(J)) readJson(j, 'x.json');
    return JSON.stringify({ points: D.lat.length, visits: D.visits.map(v => v.id), trips: D.trips.map(t => [t.mode, +t.km.toFixed(1)]),
      years: [...new Set(D.t.map(t => new Date(t * 1000).getUTCFullYear()))].sort(), names: topPlaces(D.visits).map(p => placeName(p, null)) }); })()`));
  assert.strictEqual(o.points, 14);
  assert.deepStrictEqual(o.visits, ['W', 'H', 'G', 'P']);
  assert.deepStrictEqual(o.trips, [['Car', 6.2], ['Walking', 9.8], ['Train', 17.5]]);
  assert.deepStrictEqual(o.years, [2016, 2019, 2024, 2025]);
  assert.deepStrictEqual(o.names, ['Home', 'Work', '15.5527, 73.7517', 'Gateway of India']);
});

test('a huge Records.json is scanned in pieces without parsing it whole', async () => {
  const p = page();
  const pts = Array.from({ length: 300 }, (_, i) => ({ latitudeE7: 120000000 + i, longitudeE7: 770000000 - i, accuracy: 9, timestamp: '2017-0' + (1 + i % 9) + '-01T10:00:00Z' }));
  p.sandbox.TXT = JSON.stringify({ locations: pts }, null, 2);
  const o = JSON.parse(await p.run(`(async () => { await scanRecords(new Blob([TXT]), () => {}); return JSON.stringify([D.lat.length, D.lat[299], D.lng[299], new Date(D.t[0] * 1000).getUTCFullYear()]); })()`));
  assert.deepStrictEqual(o, [300, 12.0000299, 76.9999701, 2017]);
});

test('files that are not location history are refused', () => {
  const p = page();
  assert.throws(() => p.run(`readJson({ hello: 1 }, 'notes.json')`), /isn't a location history file/);
});

test('map projection goes there and back', () => {
  const p = page();
  const o = JSON.parse(p.run(`JSON.stringify([[12.9716, 77.5946], [-33.86, 151.21], [64.1, -21.9]].map(([a, b]) => [+MiniMap.latOf(MiniMap.my(a)).toFixed(6), +MiniMap.lngOf(MiniMap.mx(b)).toFixed(6)]))`));
  assert.deepStrictEqual(o, [[12.9716, 77.5946], [-33.86, 151.21], [64.1, -21.9]]);
});
