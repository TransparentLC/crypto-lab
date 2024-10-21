import { type JwtVariables } from 'hono/jwt';
import { type HttpBindings } from '@hono/node-server';

declare global {
    namespace SQLiteZSTD {
        // https://github.com/phiresky/sqlite-zstd/blob/3a820f34f326a2d177292071af42104d2634316c/src/transparent.rs#L44
        type TransparentCompressConfig  = {
            table: string,
            column: string,
            compression_level: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19,
            dict_chooser: string | "'[nodict]'",
            min_dict_size_bytes_for_training?: number,
            dict_size_ratio?: number,
            train_dict_samples_ratio?: number,
            incremental_compression_step_bytes?: number,
        };
    };

    // https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
    type TurnstileResponse = {
        success: boolean,
        challenge_ts: string,
        hostname: string,
        'error-codes': (
            'missing-input-secret'
            | 'invalid-input-secret'
            | 'missing-input-response'
            | 'invalid-input-response'
            | 'bad-request'
            | 'timeout-or-duplicate'
            | 'internal-error'
        )[],
        action: string,
        cdata: string,
    };

    type HonoSchema = {
        Bindings: HttpBindings,
        Variables: JwtVariables<{
            iss?: string;
            sub?: string;
            aud?: string[] | string;
            exp?: number;
            nbf?: number;
            iat?: number;
            jti?: string;
            // Extended
            uid: number,
            username: string,
            role: 'admin' | 'user',
        }>,
    };

    type ResetPasswordPayload = {
        uid: number,
        password: string,
        exp: number,
    };

    // https://github.com/criyle/go-judge/blob/master/README.cn.md#rest-api-%E6%8E%A5%E5%8F%A3%E5%AE%9A%E4%B9%89
    namespace GoJudge {
        interface LocalFile {
            src: string; // 文件绝对路径
        };

        interface MemoryFile {
            content: string | Buffer; // 文件内容
        };

        interface PreparedFile {
            fileId: string; // 文件 id
        };

        interface Collector {
            name: string; // copyOut 文件名
            max: number;  // 最大大小限制
            pipe?: boolean; // 通过管道收集（默认值为false文件收集）
        };

        interface Symlink {
            symlink: string; // 符号连接目标 (v1.6.0+)
        };

        interface StreamIn {
            streamIn: boolean; // 流式输入 (v1.8.1+)
        };

        interface StreamOut {
            streamOut: boolean; // 流式输出 (v1.8.1+)
        };

        interface Cmd {
            args: string[]; // 程序命令行参数
            env?: string[]; // 程序环境变量

            // 指定 标准输入、标准输出和标准错误的文件 (null 是为了 pipe 的使用情况准备的，而且必须被 pipeMapping 的 in / out 指定)
            files?: (LocalFile | MemoryFile | PreparedFile | Collector | StreamIn | StreamOut | null)[];
            tty?: boolean; // 开启 TTY （需要保证标准输出和标准错误为同一文件）同时需要指定 TERM 环境变量 （例如 TERM=xterm）

            // 资源限制
            cpuLimit?: number;     // CPU时间限制，单位纳秒
            clockLimit?: number;   // 等待时间限制，单位纳秒 （通常为 cpuLimit 两倍）
            memoryLimit?: number;  // 内存限制，单位 byte
            stackLimit?: number;   // 栈内存限制，单位 byte
            procLimit?: number;    // 线程数量限制
            cpuRateLimit?: number; // 仅 Linux，CPU 使用率限制，1000 等于单核 100%
            cpuSetLimit?: string;  // 仅 Linux，限制 CPU 使用，使用方式和 cpuset cgroup 相同 （例如，`0` 表示限制仅使用第一个核）
            strictMemoryLimit?: boolean; // deprecated: 使用 dataSegmentLimit （这个选项依然有效）
            dataSegmentLimit?: boolean; // 仅linux，开启 rlimit 堆空间限制（如果不使用cgroup默认开启）
            addressSpaceLimit?: boolean; // 仅linux，开启 rlimit 虚拟内存空间限制（非常严格，在所以申请时触发限制）

            // 在执行程序之前复制进容器的文件列表
            copyIn?: {[dst:string]:LocalFile | MemoryFile | PreparedFile | Symlink};

            // 在执行程序后从容器文件系统中复制出来的文件列表
            // 在文件名之后加入 '?' 来使文件变为可选，可选文件不存在的情况不会触发 FileError
            copyOut?: string[];
            // 和 copyOut 相同，不过文件不返回内容，而是返回一个对应文件 ID ，内容可以通过 /file/:fileId 接口下载
            copyOutCached?: string[];
            // 指定 copyOut 复制文件大小限制，单位 byte
            copyOutMax?: number;
        };

        enum Status {
            Accepted = 'Accepted', // 正常情况
            MemoryLimitExceeded = 'Memory Limit Exceeded', // 内存超限
            TimeLimitExceeded = 'Time Limit Exceeded', // 时间超限
            OutputLimitExceeded = 'Output Limit Exceeded', // 输出超限
            FileError = 'File Error', // 文件错误
            NonzeroExitStatus = 'Nonzero Exit Status', // 非 0 退出值
            Signalled = 'Signalled', // 进程被信号终止
            InternalError = 'Internal Error', // 内部错误
            WrongAnswer = 'Wrong Answer',
        };

        interface PipeIndex {
            index: number; // cmd 的下标
            fd: number;    // cmd 的 fd
        };

        interface PipeMap {
            in: PipeIndex;  // 管道的输入端
            out: PipeIndex; // 管道的输出端
            // 开启管道代理，传输内容会从输出端复制到输入端
            // 输入端内容在输出端关闭以后会丢弃 （防止 SIGPIPE ）
            proxy?: boolean;
            name?: string;   // 如果代理开启，内容会作为 copyOut 放在输入端 （用来 debug ）
            // 限制 copyOut 的最大大小，代理会在超出大小之后正常复制
            max?: number;
        };

        enum FileErrorType {
            CopyInOpenFile = 'CopyInOpenFile',
            CopyInCreateFile = 'CopyInCreateFile',
            CopyInCopyContent = 'CopyInCopyContent',
            CopyOutOpen = 'CopyOutOpen',
            CopyOutNotRegularFile = 'CopyOutNotRegularFile',
            CopyOutSizeExceeded = 'CopyOutSizeExceeded',
            CopyOutCreateFile = 'CopyOutCreateFile',
            CopyOutCopyContent = 'CopyOutCopyContent',
            CollectSizeExceeded = 'CollectSizeExceeded',
        };

        interface FileError {
            name: string; // 错误文件名称
            type: FileErrorType; // 错误代码
            message?: string; // 错误信息
        };

        interface Request {
            requestId?: string; // 给 WebSocket 使用来区分返回值的来源请求
            cmd: Cmd[];
            pipeMapping?: PipeMap[];
        };

        interface CancelRequest {
            cancelRequestId: string; // 取消某个正在进行中的请求
        };

        // WebSocket 请求
        type WSRequest = Request | CancelRequest;

        interface Result {
            status: Status;
            error?: string; // 详细错误信息
            exitStatus: number; // 程序返回值
            time: number;   // 程序运行 CPU 时间，单位纳秒
            memory: number; // 程序运行内存，单位 byte
            runTime: number; // 程序运行现实时间，单位纳秒
            // copyOut 和 pipeCollector 指定的文件内容
            files?: {[name:string]:string};
            // copyFileCached 指定的文件 id
            fileIds?: {[name:string]:string};
            // 文件错误详细信息
            fileError?: FileError[];
        };

        // WebSocket 结果
        interface WSResult {
            requestId: string;
            results: Result[];
            error?: string;
        };

        // 流式请求 / 响应
        interface Resize {
            index: number;
            fd: number;
            rows: number;
            cols: number;
            x: number;
            y: number;
        };

        interface Input {
            index: number;
            fd: number;
            content: Buffer;
        };

        interface Output {
            index: number;
            fd: number;
            content: Buffer;
        };
    };
};
