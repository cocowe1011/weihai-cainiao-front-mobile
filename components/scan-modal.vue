<template>
  <view class="scan-modal-overlay" v-if="visible" @click="handleClose">
    <view class="scan-modal-content" @click.stop>
      <!-- Loading 遮罩：处理中覆盖整个弹窗 -->
      <view class="processing-overlay" v-if="processing">
        <view class="processing-box">
          <view class="processing-spinner"></view>
          <text class="processing-text">数据入队中，请稍候...</text>
          <text class="processing-hint">处理完成后可继续扫码</text>
        </view>
      </view>

      <!-- 扫码区域（待扫码状态） -->
      <view class="scan-area">
        <view class="scan-icon-wrapper">
          <uni-icons type="scan" size="60" color="#0c1f4c"></uni-icons>
        </view>
        <view class="scan-title">连续扫码中</view>
        <view class="scan-subtitle">请扣动扫码枪，扫描大包条码</view>

        <!-- 本次已扫数量 -->
        <view class="scan-count">
          <text class="count-num">{{ count }}</text>
          <text class="count-label">本次已扫</text>
        </view>

        <!-- 最近处理结果 -->
        <view class="scan-result" v-if="lastResult">
          <text class="result-label">最近结果：</text>
          <text class="result-value" :class="lastResultType">{{ lastResult }}</text>
          <text v-if="hasDetail" class="result-detail" @click.stop="onShowDetail">查看原因</text>
        </view>
      </view>

      <!-- 备用扫码方式 -->
      <view class="alternative-scan">
        <text class="alternative-text">扫描不到？</text>
        <text class="camera-scan-btn" @click="handleCameraScan">点击使用相机扫码</text>
      </view>

      <!-- 操作按钮 -->
      <view class="action-buttons">
        <view class="action-btn close-btn" @click="handleClose">关闭</view>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  name: 'scan-modal',
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    // 父组件回传的最近处理结果，用于弹窗内展示
    lastResult: {
      type: String,
      default: ''
    },
    lastResultType: {
      type: String,
      default: 'ok' // ok | err
    },
    // 有原始报错时显示「查看原因」
    hasDetail: {
      type: Boolean,
      default: false
    },
    // 父组件是否正在处理（查询/入队），用于图标动画
    processing: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      count: 0
    }
  },
  watch: {
    visible(newVal) {
      if (newVal) {
        // 打开弹窗：重置计数并注册广播接收（默认连续扫码）
        this.count = 0
        this.initScan()
        this.startScan()
      } else {
        this.stopScan()
      }
    }
  },
  created() {
    // 非响应式实例属性
    this._main = null
    this._receiver = null
    this._filter = null
    this._dedupeTag = false
  },
  beforeDestroy() {
    this.stopScan()
  },
  methods: {
    // 初始化PDA扫码广播（同时支持海康 + 东集）
    initScan() {
      // #ifdef APP-PLUS
      try {
        this._main = plus.android.runtimeMainActivity()
        const IntentFilter = plus.android.importClass('android.content.IntentFilter')
        this._filter = new IntentFilter()
        this._filter.addAction('com.service.scanner.data') // 海康PDA
        this._filter.addAction('com.seuic.scan') // 东集PDA
        this._filter.addAction('com.android.server.scannerservice.broadcast') // 东集（兼容旧版）
        this._filter.addAction('com.android.server.aa') // 东集（兼容旧版）

        const that = this
        this._receiver = plus.android.implements(
          'io.dcloud.feature.internal.reflect.BroadcastReceiver',
          {
            onReceive: function (context, intent) {
              plus.android.importClass(intent)
              let code = intent.getStringExtra('ScanCode') // 海康标签
              if (!code) {
                code = intent.getStringExtra('scannerdata') // 东集标签
              }
              that.onReceive(code)
            }
          }
        )
      } catch (error) {
        console.error('PDA扫码初始化失败:', error)
      }
      // #endif
    },

    startScan() {
      // #ifdef APP-PLUS
      if (this._main && this._receiver && this._filter) {
        try {
          this._main.registerReceiver(this._receiver, this._filter)
        } catch (error) {
          console.error('启动扫码监听失败:', error)
        }
      }
      // #endif
    },

    stopScan() {
      // #ifdef APP-PLUS
      if (this._main && this._receiver) {
        try {
          this._main.unregisterReceiver(this._receiver)
        } catch (error) {
          console.error('停止扫码监听失败:', error)
        }
      }
      // #endif
    },

    // 收到扫码广播：处理中屏蔽新扫码，确保上一个包裹后台返回后才能扫下一个
    onReceive(code) {
      // 150ms 去抖，避免同一次扫码重复触发
      if (this._dedupeTag) return
      this._dedupeTag = true
      setTimeout(() => {
        this._dedupeTag = false
      }, 150)

      if (!code) return

      // 处理中：屏蔽扫码，提示用户等待
      if (this.processing) {
        uni.showToast({ title: '请等待当前包裹处理完成', icon: 'none', duration: 1500 })
        return
      }

      try {
        uni.vibrateLong()
      } catch (e) {}
      this.count++
      this.$emit('scan', code)
    },

    // 备用：相机扫码（处理中同样屏蔽）
    handleCameraScan() {
      if (this.processing) {
        uni.showToast({ title: '请等待当前包裹处理完成', icon: 'none', duration: 1500 })
        return
      }
      uni.scanCode({
        success: (res) => {
          if (res && res.result) {
            // 相机回调时再次检查（异步可能有延迟）
            if (this.processing) {
              uni.showToast({ title: '请等待当前包裹处理完成', icon: 'none', duration: 1500 })
              return
            }
            this.count++
            this.$emit('scan', res.result)
          }
        },
        fail: (err) => {
          console.error('相机扫码失败:', err)
          uni.showToast({ title: '扫码失败', icon: 'none' })
        }
      })
    },

    handleClose() {
      this.$emit('close')
    },

    onShowDetail() {
      this.$emit('show-detail')
    }
  }
}
</script>

<style lang="scss" scoped>
.scan-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.scan-modal-content {
  width: 85%;
  max-width: 620rpx;
  background: #ffffff;
  border-radius: 24rpx;
  overflow: hidden;
  box-shadow: 0 8rpx 30rpx rgba(0, 0, 0, 0.15);
  position: relative;
}

/* Loading 遮罩 */
.processing-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.92);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  border-radius: 24rpx;
}

.processing-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40rpx;
}

.processing-spinner {
  width: 72rpx;
  height: 72rpx;
  border: 6rpx solid #e5e7eb;
  border-top: 6rpx solid #2563eb;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 28rpx;
}

.processing-text {
  font-size: 30rpx;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 12rpx;
}

.processing-hint {
  font-size: 24rpx;
  color: #9ca3af;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.scan-area {
  padding: 50rpx 40rpx 36rpx;
  text-align: center;
  background: linear-gradient(180deg, #f8f9fa 0%, #ffffff 100%);

  .scan-icon-wrapper {
    margin-bottom: 20rpx;
  }

  .scan-title {
    font-size: 34rpx;
    font-weight: 600;
    color: #1f2937;
    margin-bottom: 12rpx;
  }

  .scan-subtitle {
    font-size: 26rpx;
    color: #6b7280;
    margin-bottom: 24rpx;
  }

  .scan-count {
    display: flex;
    align-items: baseline;
    justify-content: center;
    margin-bottom: 20rpx;

    .count-num {
      font-size: 56rpx;
      font-weight: 700;
      color: #0c1f4c;
      line-height: 1;
    }

    .count-label {
      font-size: 24rpx;
      color: #9ca3af;
      margin-left: 12rpx;
    }
  }

  .scan-result {
    background: #f0f9ff;
    border: 1px solid #bfdbfe;
    border-radius: 12rpx;
    padding: 18rpx 20rpx;

    .result-label {
      font-size: 24rpx;
      color: #6b7280;
    }

    .result-detail {
      display: block;
      margin-top: 12rpx;
      font-size: 26rpx;
      color: #2563eb;
    }

    .result-value {
      font-size: 26rpx;
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
}

.alternative-scan {
  padding: 22rpx 40rpx;
  text-align: center;
  background: #ffffff;
  border-top: 1px dashed #e5e7eb;

  .alternative-text {
    font-size: 24rpx;
    color: #9ca3af;
    margin-right: 8rpx;
  }

  .camera-scan-btn {
    font-size: 24rpx;
    color: #2563eb;
    text-decoration: underline;

    &:active {
      color: #1d4ed8;
    }
  }
}

.action-buttons {
  display: flex;
  padding: 20rpx 40rpx 36rpx;
  background: #ffffff;
}

.action-btn {
  flex: 1;
  text-align: center;
  padding: 24rpx 0;
  font-size: 30rpx;
  font-weight: 500;
  border-radius: 12rpx;
}

.close-btn {
  background: #f3f4f6;
  color: #4b5563;

  &:active {
    background: #e5e7eb;
  }
}
</style>
