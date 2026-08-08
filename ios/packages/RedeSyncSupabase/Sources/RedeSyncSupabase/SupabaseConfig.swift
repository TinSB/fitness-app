// SupabaseConfig — 后端的连接坐标。
//
// 放在本包而不是 RedeSync：RedeSync 声明自己后端无关，让它认识 Supabase 的域名
// 就破坏了那条边界。换后端时删掉整个 RedeSyncSupabase 包即可，RedeSync 一行不动。
//
// 关于「密钥为什么可以写在代码里」：publishable key **不是** secret。它的设计用途
// 就是嵌进客户端二进制分发给每一个用户——任何人都能从 .ipa 里提取出来，藏起来没有
// 任何意义，Supabase 后台对它的原话是「can be safely shared publicly」。
// 真正的安全边界在服务端（见 supabase/schema.sql）：
//   ① anon 角色在两张表上零权限（revoke all）
//   ② authenticated 只有 CRUD 四项，且 RLS 限制到 auth.uid() = user_id
//   ③ 没有 TRUNCATE —— 它不受 RLS 约束，已显式拔除
// 拿着这个 key 而没有有效登录态，一行数据都读不到。
//
// ⛔️ secret key（sb_secret_*）是另一回事：它绕过 RLS，绝不可进代码、日志、截图
// 或任何客户端可达的地方。本文件永远不该出现它。

import Foundation

public enum SupabaseConfig {
    public static let projectURLString = "https://xlabbpgtllhialebhoof.supabase.co"

    public static var projectURL: URL {
        // 常量字面量，构造失败等于编译期就写错了。
        guard let url = URL(string: projectURLString) else {
            preconditionFailure("SupabaseConfig.projectURLString 不是合法 URL")
        }
        return url
    }

    /// 可公开分发的客户端 key，见文件头说明。
    public static let publishableKey = "sb_publishable_fbHEYt43JXKMUKP6x3j57w_J95QNBKm"
}
