# 签名密钥

## 现状

4.00.x 时期已经用 `legado-签名.jks`（`CN=Reader Fanqie Style`）签过一批包，
**继续沿用同一把钥匙**，否则老用户无法覆盖升级，只能卸载重装（书架、进度、书源、字体全丢）。

因此本仓库正式发版：

| 项 | 值 |
|---|---|
| 文件名 | `keystore/release.jks`（本地与 CI 用同一份，二进制不进 git） |
| 来源 | 由 `legado-签名.jks` 复制而来，别名与口令不变 |
| 别名 | `legado` |
| 口令 | 见团队密码管理器；**不在本文件明文写** |
| 证书签名 | `CN=Reader Fanqie Style` |

历史记录见 `D:\github\projects\reader-merge-20261105\keystore\`（老项目保留原件）。

## 规矩

1. **一签永定**：一旦用它发过包，这把钥匙就不能换、不能丢。
2. 丢失后果：所有老用户无法覆盖升级，只能卸载重装；Google Play/应用商店也会拒绝。
3. 离线备份：U 盘 + 私有网盘 + 纸面口令，三处各一份。
4. 不进 git：`.gitignore` 已排除 `keystore/*.jks`；CI 走仓库 Secret `KEYSTORE_B64`。
5. 更换钥匙的唯一合法时机：**大版本且明确告知用户要卸载重装**的时候（如 5.0.0）。

## CI 需要填的 Secret

| Secret | 值 |
|---|---|
| `KEYSTORE_B64` | `[Convert]::ToBase64String([IO.File]::ReadAllBytes('keystore\release.jks'))` |
| `KEYSTORE_PASSWORD` | keystore 口令 |
| `KEY_ALIAS` | `legado` |
| `KEY_PASSWORD` | key 口令 |

## 校验命令

```powershell
$bt = 'D:\github\projects\electro-tutor-20261005\.android-tools\android-sdk\build-tools\36.0.0'
& "$bt\apksigner.bat" verify --print-certs --verbose dist\阅读-番茄排版-arm64-4.1.0.apk
```

指纹必须与老包一致：

```
SHA-256: 624e877f…42667f
```