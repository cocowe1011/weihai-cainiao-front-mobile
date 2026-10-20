<template>
  <view class="home-container">
    <!-- 状态栏占位 -->
    <view class="status-bar" :style="{ height: statusBarHeight + 'px' }"></view>

    <!-- 顶部导航栏 -->
    <view class="header">
      <view class="welcome">欢迎，{{ username }}</view>
      <view class="logout" @tap="handleLogout">退出登录</view>
    </view>

    <!-- 上半部分：扫码区（固定不滚动） -->
    <view class="section scan-section">
      <view class="section-header">
        <view class="section-dot dot-red"></view>
        <text class="section-title">扫码上货</text>
        <view class="cainiao-switch" :class="{ on: disableCainiao }">
          <text class="cainiao-switch-label">停用菜鸟</text>
          <switch
            class="cainiao-switch-ctrl"
            :key="cainiaoSwitchKey"
            :checked="disableCainiao"
            color="#d97706"
            @change="onCainiaoSwitch"
          />
        </view>
      </view>

      <view class="section-card scan-card">
        <!-- 扫码按钮：点击弹窗，弹窗内默认连续扫码 -->
        <view
          class="scan-btn"
          :class="{ 'btn-loading': scanning }"
          @tap="openScanModal"
        >
          <uni-icons type="scan" size="20" color="#fff"></uni-icons>
          <text class="scan-btn-text">{{ scanning ? '处理中…' : '点击扫码' }}</text>
        </view>

        <!-- 浏览器无法扫码，手动输入大包号走同一套入队流程 -->
        <!-- #ifdef H5 -->
        <view class="mock-scan">
          <input
            class="mock-scan-input"
            v-model="mockBarcode"
            placeholder="输入大包号"
            confirm-type="done"
            @confirm="submitMockScan"
          />
          <view
            class="mock-scan-btn"
            :class="{ 'btn-loading': scanning }"
            @tap="submitMockScan"
          >模拟调用</view>
        </view>
        <!-- #endif -->

        <!-- 最近扫码结果：只留一行，长报错点「查看原因」 -->
        <view class="last-scan" v-if="lastScanText">
          <text class="last-scan-label">最近：</text>
          <text class="last-scan-value" :class="lastScanType">{{ lastScanText }}</text>
          <text
            v-if="lastScanDetail"
            class="last-scan-detail"
            @tap="showErrorDetail = true"
          >查看原因</text>
        </view>
      </view>
    </view>

    <!-- 下半部分：PDA扫码队列 -->
    <view class="section queue-header-section">
      <view class="section-header">
        <view class="section-dot dot-green"></view>
        <text class="section-title">PDA扫码队列</text>
        <view class="count-badge">{{ queueList.length }}</view>
        <view
          class="refresh-btn"
          :class="{ spinning: queueLoading }"
          @tap="refreshQueue"
        >
          <uni-icons type="refresh" size="18" color="#3b82f6"></uni-icons>
        </view>
      </view>
    </view>
    <!-- 队列卡片（可滚动） -->
    <scroll-view scroll-y class="queue-scroll">
      <view class="section queue-body-section">

        <view class="queue-card">
          <view v-if="queueList.length === 0" class="queue-empty">
            <uni-icons type="info" size="40" color="#d1d5db"></uni-icons>
            <text class="queue-empty-text">队列为空，扫码后包裹将进入此队列</text>
          </view>

          <view v-else class="queue-list">
            <view
              class="queue-item"
              v-for="(item, index) in queueList"
              :key="item.id"
            >
              <!-- 卡片头：序号+大包号 | 操作按钮右上角 -->
              <view class="item-header">
                <view class="item-header-left">
                  <view class="item-index">{{ index + 1 }}</view>
                  <text class="item-package-no">{{ item.packageNo || '--' }}</text>
                </view>
                <view class="item-actions">
                  <view
                    class="act-btn act-move"
                    :class="{ 'act-disabled': index === 0 || queueBusy }"
                    @tap="moveItem(index, -1)"
                  >
                    <uni-icons type="top" size="14" color="#2563eb"></uni-icons>
                  </view>
                  <view
                    class="act-btn act-move"
                    :class="{ 'act-disabled': index === queueList.length - 1 || queueBusy }"
                    @tap="moveItem(index, 1)"
                  >
                    <uni-icons type="bottom" size="14" color="#2563eb"></uni-icons>
                  </view>
                  <view
                    class="act-btn act-del"
                    :class="{ 'act-disabled': queueBusy }"
                    @tap="deleteItem(index)"
                  >
                    <uni-icons type="trash" size="14" color="#ef4444"></uni-icons>
                  </view>
                </view>
              </view>
              <!-- 卡片体：字段信息（对齐WCS队列卡片） -->
              <view class="item-body">
                <view class="info-row">
                  <text class="info-label">渠道</text>
                  <text class="info-value">{{ item.channel || '--' }}</text>
                  <text class="info-label size-label">包裹类型</text>
                  <text class="info-value size-value" :class="item.packageSize === 'large' ? 'val-large' : 'val-small'">
                    {{ item.packageSize === 'large' ? '大包' : '小包' }}
                  </text>
                </view>
                <view class="info-row">
                  <text class="info-label">包装重量</text>
                  <text class="info-value">{{ item.packingWeight || '--' }}</text>
                  <text class="info-label">小包数量</text>
                  <text class="info-value">{{ item.expectedQty || '--' }}</text>
                </view>
                <view class="info-row time-row">
                  <text class="info-label">扫码时间</text>
                  <text class="info-value time-value">{{ item.scanTime || '--' }}</text>
                </view>
              </view>
            </view>
          </view>
        </view>
      </view>
      <view class="bottom-space"></view>
    </scroll-view>

    <!-- 连续扫码弹窗 -->
    <scan-modal
      :visible="showScanModal"
      :last-result="lastScanText"
      :last-result-type="lastScanType"
      :has-detail="!!lastScanDetail"
      :processing="scanning"
      @close="onModalClose"
      @scan="onModalScan"
      @show-detail="showErrorDetail = true"
    />

    <!-- 失败原因：盖在扫码弹窗上面，完整报错在这里看 -->
    <view class="err-mask" v-if="showErrorDetail" @tap="showErrorDetail = false">
      <view class="err-panel" @tap.stop>
        <text class="err-title">失败原因</text>
        <scroll-view scroll-y class="err-body">
          <text class="err-text" selectable>{{ lastScanDetail }}</text>
        </scroll-view>
        <view class="err-close" @tap="showErrorDetail = false">知道了</view>
      </view>
    </view>
  </view>
</template>

<script>
import ScanModal from '@/components/scan-modal.vue'
import request, { cainiaoRequest } from '@/config/request.js'
import { mapCainiaoToPackage, mockPackageByBarcode } from '@/utils/packageMockData.js'

// 菜鸟大包查询接口路径（与后端模拟接口路径一致）
const CAINIAO_PATH = '/api-intranet/trans/packageData/getBigPackageToMCS'

export default {
  components: { ScanModal },
  data() {
    return {
      statusBarHeight: 0,
      username: '用户',
      // 扫码弹窗
      showScanModal: false,
      // 浏览器模拟扫码用的大包号
      mockBarcode: 'KRRM05193744',
      // 扫码处理中
      scanning: false,
      // 停用菜鸟：true 走 mock，false（默认）查菜鸟大包接口
      disableCainiao: false,
      // 取消切换时重建开关，避免原生开关和数据不一致
      cainiaoSwitchKey: 0,
      // 最近扫码结果
      lastScanText: '',
      lastScanType: 'ok', // ok | err
      // 菜鸟失败时的原始报错，点「查看原因」再看
      lastScanDetail: '',
      showErrorDetail: false,
      // PDA扫码队列
      queueList: [],
      // 手动查询中（刷新按钮 / 进入页面）
      queueLoading: false,
      // 删除或移动进行中，避免重复点击
      queueBusy: false,
      // 队列轮询定时器
      pollTimer: null
    }
  },
  onLoad() {
    const sysInfo = uni.getSystemInfoSync()
    this.statusBarHeight = sysInfo.statusBarHeight || 0
    try {
      const saved = uni.getStorageSync('username')
      if (saved) this.username = saved
    } catch (e) {
      console.error('读取用户信息失败:', e)
    }
  },
  onShow() {
    this.refreshQueue()
    this.startPolling()
  },
  onHide() {
    this.stopPolling()
  },
  onUnload() {
    this.stopPolling()
  },
  beforeDestroy() {
    this.stopPolling()
  },
  methods: {
    handleLogout() {
      uni.showModal({
        title: '确认退出',
        content: '确定要退出登录吗？',
        confirmText: '确认退出',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            uni.removeStorageSync('token')
            uni.removeStorageSync('username')
            uni.removeStorageSync('userCode')
            uni.reLaunch({ url: '/pages/login/login' })
          }
        }
      })
    },

    // ============ 扫码弹窗 ============

    openScanModal() {
      this.showScanModal = true
    },

    onModalClose() {
      this.showScanModal = false
    },

    // 弹窗内每扫到一个条码触发一次（scan-modal已在processing时屏蔽扫码，此处双重保险）
    onModalScan(code) {
      // 安全护栏：如果仍在处理中，直接丢弃
      if (this.scanning) return
      this.processBarcode(code)
    },

    // 浏览器手动触发，与扫码枪走同一套校验、查询、入队
    submitMockScan() {
      if (this.scanning) return
      this.processBarcode(this.mockBarcode)
    },

    // ============ 扫码入队主流程（判断与五面扫一致） ============

    async processBarcode(rawCode) {
      const raw = (rawCode || '').trim()

      // 1. 条码校验
      if (!raw) {
        this.setLastScan('条码为空', 'err')
        return
      }
      if (raw.indexOf('NoRead') !== -1) {
        this.setLastScan(`未读到条码（${raw}）`, 'err')
        return
      }
      if (raw.split(',').length > 1) {
        this.setLastScan(`读到多个条码（${raw}）`, 'err')
        return
      }
      const bracketMatches = raw.match(/\[[^\]]*\]/g)
      if (bracketMatches && bracketMatches.length >= 2) {
        this.setLastScan(`多码格式条码（${raw}）`, 'err')
        return
      }
      // 单码：去除首尾方括号
      let barcode = raw
      if (barcode.startsWith('[') && barcode.endsWith(']')) {
        barcode = barcode.slice(1, -1).trim()
      }
      if (!barcode) {
        this.setLastScan('条码为空', 'err')
        return
      }

      this.scanning = true
      try {
        // 2. 重复校验：PDA扫码队列 + 1008 + 1010
        const dupMsg = await this.checkDuplicate(barcode)
        if (dupMsg) {
          this.setLastScan(dupMsg, 'err')
          return
        }

        // 3. 查询包裹信息（菜鸟接口）
        const packageInfo = await this.resolvePackageInfo(barcode)

        // 4. 入队（PDA只建队列、不落库order_info；order_info由WCS出队下发时统一保存）
        const ok = await this.enqueuePackage(packageInfo)
        if (ok) {
          const prefix = this.disableCainiao ? '入队成功（Mock）' : '入队成功'
          this.setLastScan(`${prefix}：${barcode}`, 'ok')
        } else {
          this.setLastScan(`入队失败：${barcode}`, 'err')
        }
      } catch (e) {
        console.error('扫码处理异常:', e)
        const detail = (e && (e.errMsg || e.message)) || JSON.stringify(e)
        this.setLastScan(`菜鸟查询失败：${barcode}`, 'err', detail)
      } finally {
        this.scanning = false
      }
    },

    // 重复校验：PDA扫码队列(17) / 1008(1) / 1010(15)
    async checkDuplicate(barcode) {
      const pdaList = await this.fetchPdaList()
      if (pdaList.some((it) => (it.packageNo || '').trim() === barcode)) {
        return `条码重复（PDA扫码队列已存在）：${barcode}`
      }
      try {
        const res = await request.post('/queue_info/queryQueueList', {})
        const list = (res && res.data) || []
        for (const q of list) {
          if (q.id === 1 || q.id === 15) {
            let arr = []
            try {
              arr = q.trayInfo ? JSON.parse(q.trayInfo) : []
            } catch (e) {
              arr = []
            }
            if (arr.some((it) => (it.packageNo || '').trim() === barcode)) {
              const name = q.id === 1 ? '1008' : '1010'
              return `条码重复（${name}队列已存在）：${barcode}`
            }
          }
        }
      } catch (e) {
        console.error('查询队列列表失败:', e)
      }
      return ''
    },

    onCainiaoSwitch(e) {
      const willDisable = !!(e.detail && e.detail.value)
      uni.showModal({
        title: '提示',
        content: willDisable
          ? '确定要停用菜鸟接口吗？停用后将使用 Mock 数据。'
          : '确定要重新启用菜鸟接口吗？',
        success: (res) => {
          if (!res.confirm) {
            this.cainiaoSwitchKey += 1
            return
          }
          this.disableCainiao = willDisable
          uni.showToast({
            title: this.disableCainiao ? '已停用菜鸟' : '已启用菜鸟',
            icon: 'none'
          })
        },
        fail: () => {
          this.cainiaoSwitchKey += 1
        }
      })
    },

    // 查询包裹信息：停用菜鸟走 mock，否则调用菜鸟大包接口
    async resolvePackageInfo(barcode) {
      if (this.disableCainiao) {
        return mockPackageByBarcode(barcode)
      }
      const res = await cainiaoRequest.post(CAINIAO_PATH, {
        bigPackageCode: barcode
      })
      const codeOk = res && (Number(res.code) === 200 || res.success === true)
      const data = res && res.data
      const hasPackage =
        data && (data.bigPackageCode || data.smallPackageQuantity != null)
      if (!codeOk || !hasPackage) {
        throw new Error(JSON.stringify(res))
      }
      return mapCainiaoToPackage(data, barcode)
    },

    // 入队：调后端 push 接口，一个包裹 INSERT 一行（行级操作，避免整队列覆盖）
    async enqueuePackage(packageInfo) {
      try {
        const res = await request.post('/pda_queue/push', {
          packageNo: packageInfo.packageNo,
          channel: packageInfo.channel,
          packageSize: packageInfo.packageSize,
          chargeWeight: packageInfo.chargeWeight,
          packingWeight: packageInfo.packingWeight,
          expectedQty: packageInfo.expectedQty
        })
        if (res && (res.code === '200' || res.success === true)) {
          await this.loadQueue()
          return true
        }
        return false
      } catch (e) {
        console.error('入队失败:', e)
        return false
      }
    },

    // ============ 队列管理（pda_scan_queue 明细表，行级操作） ============

    // 拉取PDA扫码队列明细（按 seq_no 升序，队头在前）
    async fetchPdaList() {
      try {
        const res = await request.get('/pda_queue/list')
        const list = (res && res.data) || []
        return Array.isArray(list) ? list : []
      } catch (e) {
        console.error('查询PDA扫码队列失败:', e)
        return []
      }
    },

    async loadQueue() {
      this.queueList = await this.fetchPdaList()
    },

    // 用户主动查询：进入页面、点刷新。带遮罩，避免看起来没反应
    async refreshQueue() {
      if (this.queueLoading || this.queueBusy) return
      this.queueLoading = true
      uni.showLoading({ title: '查询中', mask: true })
      try {
        await this.loadQueue()
      } finally {
        this.queueLoading = false
        uni.hideLoading()
      }
    },

    startPolling() {
      this.stopPolling()
      this.pollTimer = setInterval(() => {
        // 扫码、查询、删除、移动进行中不刷新，避免打断和闪烁
        if (!this.scanning && !this.queueLoading && !this.queueBusy) {
          this.loadQueue()
        }
      }, 2000)
    },

    stopPolling() {
      if (this.pollTimer) {
        clearInterval(this.pollTimer)
        this.pollTimer = null
      }
    },

    // 删除队列项：按主键行级删除
    deleteItem(index) {
      if (this.queueBusy || this.queueLoading) return
      const item = this.queueList[index]
      if (!item || !item.id) return
      uni.showModal({
        title: '确认删除',
        content: `确定要将大包 ${item.packageNo || ''} 移出队列吗？`,
        success: async (res) => {
          if (!res.confirm) return
          this.queueBusy = true
          uni.showLoading({ title: '删除中', mask: true })
          let toast = null
          try {
            const r = await request.post(
              `/pda_queue/removeById?id=${encodeURIComponent(item.id)}`
            )
            if (r && (r.code === '200' || r.success === true)) {
              await this.loadQueue()
              toast = { title: '已删除', icon: 'success' }
            } else {
              toast = { title: '删除失败', icon: 'none' }
            }
          } catch (e) {
            console.error('删除失败:', e)
            toast = { title: '网络异常', icon: 'none' }
          } finally {
            this.queueBusy = false
            uni.hideLoading()
          }
          if (toast) {
            uni.showToast(toast)
          }
        }
      })
    },

    // 移动队列项：direction = -1 上移，1 下移（后端交换相邻 seq_no）
    async moveItem(index, direction) {
      if (this.queueBusy || this.queueLoading) return
      const item = this.queueList[index]
      if (!item || !item.id) return
      const targetIndex = index + direction
      if (targetIndex < 0 || targetIndex >= this.queueList.length) return
      this.queueBusy = true
      uni.showLoading({ title: '移动中', mask: true })
      let toast = null
      try {
        const r = await request.post(
          `/pda_queue/move?id=${encodeURIComponent(item.id)}&direction=${direction}`
        )
        if (r && (r.code === '200' || r.success === true)) {
          await this.loadQueue()
        } else {
          toast = { title: '移动失败', icon: 'none' }
        }
      } catch (e) {
        console.error('移动失败:', e)
        toast = { title: '网络异常', icon: 'none' }
      } finally {
        this.queueBusy = false
        uni.hideLoading()
      }
      if (toast) {
        uni.showToast(toast)
      }
    },

    // ============ 工具 ============

    setLastScan(text, type, detail) {
      this.lastScanText = text
      this.lastScanType = type
      this.lastScanDetail = detail || ''
      this.showErrorDetail = false
    }
  }
}
</script>

<style lang="scss" scoped>
.home-container {
  position: fixed;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  background: #f0f2f5;
  display: flex;
  flex-direction: column;
}

.status-bar {
  flex-shrink: 0;
  background: $primary-gradient;
}

.header {
  flex-shrink: 0;
  background: $primary-gradient;
  padding: 20rpx 30rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #fff;

  .welcome {
    font-size: 32rpx;
    font-weight: 500;
  }

  .logout {
    font-size: 26rpx;
    padding: 8rpx 20rpx;
    border: 1px solid rgba(255, 255, 255, 0.5);
    border-radius: 30rpx;
  }
}

.scan-section {
  flex-shrink: 0;
  padding-bottom: 0;
}

.queue-header-section {
  flex-shrink: 0;
  padding-bottom: 0;
}

.queue-body-section {
  padding-top: 0;
}

.queue-scroll {
  flex: 1;
  min-height: 0;
}

.section {
  padding: 24rpx 24rpx 0;
}

.section-header {
  display: flex;
  align-items: center;
  margin-bottom: 16rpx;
  padding: 0 4rpx;
}

.section-dot {
  width: 10rpx;
  height: 32rpx;
  border-radius: 6rpx;
  background: #3b82f6;
  margin-right: 14rpx;
  flex-shrink: 0;

  &.dot-green {
    background: #10b981;
  }
  &.dot-red {
    background: #ef4444;
  }
}

.section-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #1f2937;
  flex: 1;
}

.count-badge {
  min-width: 40rpx;
  height: 40rpx;
  padding: 0 12rpx;
  border-radius: 20rpx;
  background: #e0e7ff;
  color: #3730a3;
  font-size: 24rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12rpx;
}

.refresh-btn {
  width: 52rpx;
  height: 52rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #eff6ff;

  &:active {
    opacity: 0.7;
  }

  &.spinning {
    animation: refresh-spin 0.8s linear infinite;
  }
}

@keyframes refresh-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.section-card {
  background: #fff;
  border-radius: 20rpx;
  padding: 24rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}

/* ---- 扫码卡 ---- */
.scan-card {
  display: flex;
  flex-direction: column;
}

.scan-btn {
  height: 88rpx;
  border-radius: 8rpx;
  background: #0c1f4c;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;

  &:active {
    background: #16294f;
  }

  &.btn-loading {
    background: #9ca3af;
  }

  .scan-btn-text {
    color: #fff;
    font-size: 30rpx;
    margin-left: 10rpx;
  }
}

.mock-scan {
  display: flex;
  align-items: center;
  margin-top: 16rpx;
}

.mock-scan-input {
  flex: 1;
  height: 72rpx;
  padding: 0 20rpx;
  border: 1px solid #e5e7eb;
  border-radius: 8rpx;
  font-size: 26rpx;
  color: #1f2937;
  background: #fff;
}

.mock-scan-btn {
  flex-shrink: 0;
  height: 72rpx;
  margin-left: 12rpx;
  padding: 0 24rpx;
  border-radius: 8rpx;
  background: #2563eb;
  color: #fff;
  font-size: 26rpx;
  display: flex;
  align-items: center;
  justify-content: center;

  &.btn-loading {
    background: #9ca3af;
  }
}

.cainiao-switch {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  margin-left: 12rpx;

  .cainiao-switch-label {
    font-size: 24rpx;
    color: #6b7280;
  }

  &.on .cainiao-switch-label {
    color: #b45309;
    font-weight: 600;
  }
}

.cainiao-switch-ctrl {
  transform: scale(0.72);
  transform-origin: right center;
}

.last-scan {
  margin-top: 20rpx;
  padding: 16rpx 20rpx;
  background: #f8faff;
  border-radius: 12rpx;

  .last-scan-label {
    font-size: 24rpx;
    color: #9ca3af;
  }

  .last-scan-detail {
    display: block;
    margin-top: 8rpx;
    font-size: 24rpx;
    color: #2563eb;
  }

  .last-scan-value {
    font-size: 24rpx;
    font-weight: 600;
    word-break: break-all;

    &.ok {
      color: #059669;
    }
    &.err {
      color: #dc2626;
    }
  }
}

/* ---- 队列卡 ---- */
.queue-card {
  padding: 0;
}

.queue-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 30rpx;
  background: #fff;
  border-radius: 20rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.07);

  .queue-empty-text {
    margin-top: 16rpx;
    font-size: 26rpx;
    color: #9ca3af;
    text-align: center;
  }
}

.queue-list {
  display: flex;
  flex-direction: column;
}

.queue-list .queue-item + .queue-item {
  margin-top: 20rpx;
}

.queue-item {
  border-radius: 16rpx;
  overflow: hidden;
  background: #ffffff;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.1);
  border-left: 6rpx solid #2563eb;
}

/* 卡片头 */
.item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 20rpx 12rpx;
  background: #f1f5f9;
  border-bottom: 1rpx solid #e2e8f0;
}

.item-header-left {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
}

.item-index {
  flex-shrink: 0;
  width: 40rpx;
  height: 40rpx;
  background: #2563eb;
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20rpx;
  font-weight: 700;
  margin-right: 14rpx;
}

.item-package-no {
  font-size: 26rpx;
  font-weight: 600;
  color: #1e293b;
  font-family: 'Courier New', monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}



/* 操作按钮 */
.item-actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  margin-left: 12rpx;
}

.act-btn {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 8rpx;
  background: #e8f0fe;

  &:active {
    opacity: 0.6;
    transform: scale(0.92);
  }

  &.act-del {
    background: #fee2e2;
  }

  &.act-disabled {
    opacity: 0.3;
    pointer-events: none;
  }
}

/* 卡片体 */
.item-body {
  padding: 16rpx 20rpx 18rpx;
}

.info-row {
  display: flex;
  align-items: center;
  margin-bottom: 10rpx;

  &:last-child {
    margin-bottom: 0;
  }
}

.info-label {
  font-size: 22rpx;
  color: #64748b;
  flex-shrink: 0;
  margin-right: 8rpx;

  &::after {
    content: '：';
  }
}

.info-value {
  font-size: 23rpx;
  color: #1e293b;
  font-weight: 500;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.size-label {
  margin-left: 20rpx;
  flex-shrink: 0;
}

.size-value {
  flex: 0 0 auto;
  padding: 2rpx 12rpx;
  border-radius: 8rpx;
  font-size: 21rpx;
  font-weight: 600;

  &.val-large {
    color: #b45309;
    background: rgba(254, 243, 199, 0.9);
  }
  &.val-small {
    color: #1d4ed8;
    background: rgba(219, 234, 254, 0.9);
  }
}

.time-row {
  margin-top: 4rpx;
  padding-top: 10rpx;
  border-top: 1rpx solid #f1f5f9;
}

.time-value {
  font-size: 21rpx;
  color: #94a3b8;
  font-weight: 400;
}

.bottom-space {
  height: 40rpx;
}

.err-mask {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 10000;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
}

.err-panel {
  width: 86%;
  background: #fff;
  border-radius: 20rpx;
  padding: 32rpx 28rpx 24rpx;
}

.err-title {
  display: block;
  font-size: 32rpx;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 20rpx;
}

.err-body {
  height: 420rpx;
  background: #f8fafc;
  border-radius: 12rpx;
  padding: 16rpx;
}

.err-text {
  font-size: 24rpx;
  line-height: 1.5;
  color: #b91c1c;
  word-break: break-all;
}

.err-close {
  margin-top: 24rpx;
  height: 80rpx;
  border-radius: 12rpx;
  background: #0c1f4c;
  color: #fff;
  font-size: 28rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
