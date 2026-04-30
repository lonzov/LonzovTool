<script setup>
import { ref, onMounted } from 'vue'

const records = ref(null)
const loading = ref(true)

onMounted(async () => {
  try {
    const data = await import('../data/donateRecords.json')
    const arr = data.default || data
    arr.sort((a, b) => new Date(b.time) - new Date(a.time))
    records.value = arr
  } catch {
    records.value = []
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="donate-records">
    <table>
      <thead>
        <tr>
          <th>昵称</th>
          <th>金额</th>
          <th>留言</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="loading">
          <td>加载中…</td>
          <td>加载中…</td>
          <td>加载中…</td>
        </tr>
        <tr v-else-if="records.length === 0">
          <td colspan="3" style="text-align: center; color: var(--text-tertiary)">暂无记录</td>
        </tr>
        <tr v-else v-for="(record, index) in records" :key="index">
          <td>
            <a
              v-if="record.link"
              :href="record.link"
              target="_blank"
              rel="noopener noreferrer"
            >{{ record.name }}</a>
            <span v-else>{{ record.name }}</span>
          </td>
          <td>{{ record.amount }}</td>
          <td>{{ record.note }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.donate-records {
  width: 100%;
}

.donate-records table {
  border-collapse: collapse;
  width: 100%;
  margin: 16px 0;
}

.donate-records th,
.donate-records td {
  border: 1px solid var(--border-color);
  padding: 8px 12px;
  text-align: left;
  transition: border-color 0.4s ease, background-color 0.4s ease;
}

.donate-records th {
  background: var(--bg-sub);
  font-weight: 600;
}

.donate-records a {
  color: var(--text-primary);
  text-decoration: none;
  position: relative;
  padding-bottom: 2px;
}

.donate-records a::before {
  content: '';
  display: block;
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 1px;
  background-image: repeating-linear-gradient(to right,
      color-mix(in srgb, var(--text-primary), transparent 30%) 0 4px,
      transparent 4px 8px);
  background-repeat: repeat-x;
  background-size: 8px 1px;
  transition: opacity 0.3s;
  pointer-events: none;
  z-index: 2;
}

.donate-records a::after {
  content: '';
  display: block;
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 1px;
  background-color: var(--text-primary);
  opacity: 0;
  transition: opacity 0.3s;
  pointer-events: none;
  z-index: 3;
}

.donate-records a:hover::before {
  opacity: 0;
}

.donate-records a:hover::after {
  opacity: 1;
}
</style>
