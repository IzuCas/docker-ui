import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const containersTrend = new Trend('containers_duration');
const metricsLatestTrend = new Trend('metrics_latest_duration');
const metricsStatsTrend = new Trend('metrics_stats_duration');
const imagesTrend = new Trend('images_duration');

// Test configuration
export const options = {
  stages: [
    { duration: '10s', target: 10 },   // Ramp up to 10 users
    { duration: '30s', target: 50 },   // Ramp up to 50 users
    { duration: '30s', target: 50 },   // Stay at 50 users
    { duration: '10s', target: 100 },  // Spike to 100 users
    { duration: '20s', target: 100 },  // Stay at 100 users
    { duration: '10s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests under 500ms
    errors: ['rate<0.1'],               // Error rate under 10%
    containers_duration: ['p(95)<200'], // 95% of container requests under 200ms
    metrics_latest_duration: ['p(95)<100'], // 95% of metrics requests under 100ms
  },
};

const BASE_URL = 'http://localhost:8001';

export default function () {
  // Test 1: List containers
  let containersRes = http.get(`${BASE_URL}/containers?all=true`);
  containersTrend.add(containersRes.timings.duration);
  check(containersRes, {
    'containers status is 200': (r) => r.status === 200,
    'containers response has data': (r) => r.json().length >= 0,
  }) || errorRate.add(1);

  sleep(0.1);

  // Test 2: Get latest metrics
  let metricsLatestRes = http.get(`${BASE_URL}/metrics/latest`);
  metricsLatestTrend.add(metricsLatestRes.timings.duration);
  check(metricsLatestRes, {
    'metrics/latest status is 200': (r) => r.status === 200,
  }) || errorRate.add(1);

  sleep(0.1);

  // Test 3: Get metrics stats
  let metricsStatsRes = http.get(`${BASE_URL}/metrics/stats`);
  metricsStatsTrend.add(metricsStatsRes.timings.duration);
  check(metricsStatsRes, {
    'metrics/stats status is 200': (r) => r.status === 200,
  }) || errorRate.add(1);

  sleep(0.1);

  // Test 4: List images
  let imagesRes = http.get(`${BASE_URL}/images`);
  imagesTrend.add(imagesRes.timings.duration);
  check(imagesRes, {
    'images status is 200': (r) => r.status === 200,
  }) || errorRate.add(1);

  sleep(0.1);

  // Test 5: List volumes
  let volumesRes = http.get(`${BASE_URL}/volumes`);
  check(volumesRes, {
    'volumes status is 200': (r) => r.status === 200,
  }) || errorRate.add(1);

  sleep(0.1);

  // Test 6: List networks
  let networksRes = http.get(`${BASE_URL}/networks`);
  check(networksRes, {
    'networks status is 200': (r) => r.status === 200,
  }) || errorRate.add(1);

  sleep(0.2);
}

// Summary at the end
export function handleSummary(data) {
  console.log('\n========== RESUMO DO TESTE DE CARGA ==========\n');
  
  const metrics = data.metrics;
  
  console.log('📊 Requisições HTTP:');
  console.log(`   Total: ${metrics.http_reqs.values.count}`);
  console.log(`   Rate: ${metrics.http_reqs.values.rate.toFixed(2)} req/s`);
  
  console.log('\n⏱️  Duração das Requisições:');
  console.log(`   Média: ${metrics.http_req_duration.values.avg.toFixed(2)}ms`);
  console.log(`   P90: ${metrics.http_req_duration.values['p(90)'].toFixed(2)}ms`);
  console.log(`   P95: ${metrics.http_req_duration.values['p(95)'].toFixed(2)}ms`);
  console.log(`   Max: ${metrics.http_req_duration.values.max.toFixed(2)}ms`);
  
  console.log('\n🔍 Por Endpoint:');
  if (metrics.containers_duration) {
    console.log(`   /containers - P95: ${metrics.containers_duration.values['p(95)'].toFixed(2)}ms`);
  }
  if (metrics.metrics_latest_duration) {
    console.log(`   /metrics/latest - P95: ${metrics.metrics_latest_duration.values['p(95)'].toFixed(2)}ms`);
  }
  if (metrics.metrics_stats_duration) {
    console.log(`   /metrics/stats - P95: ${metrics.metrics_stats_duration.values['p(95)'].toFixed(2)}ms`);
  }
  if (metrics.images_duration) {
    console.log(`   /images - P95: ${metrics.images_duration.values['p(95)'].toFixed(2)}ms`);
  }
  
  console.log('\n❌ Taxa de Erros:');
  console.log(`   ${((metrics.errors?.values.rate || 0) * 100).toFixed(2)}%`);
  
  console.log('\n==============================================\n');
  
  return {
    stdout: JSON.stringify(data, null, 2),
  };
}
