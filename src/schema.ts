import { integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
    uid: integer('uid').primaryKey({ autoIncrement: true }),
    username: text('username').notNull().unique(),
    password: text('password').notNull(),
    enabled: integer('enabled', { mode: 'boolean' }).default(true).notNull(),
});

export const experiments = sqliteTable('experiments', {
    expid: integer('expid').primaryKey({ autoIncrement: true }),
    title: text('title').notNull(),
    description: text('description').notNull(),
    reportSubmission: integer('report_submission', { mode: 'boolean' })
        .default(true)
        .notNull(),
    // 1000 -> 1 vCPU
    cpuLimit: integer('cpu_limit').notNull(),
    // 编译时间 ms
    compileTimeLimit: integer('compile_time_limit').notNull(),
    // 编译内存限制 bytes
    compileMemoryLimit: integer('compile_memory_limit').notNull(),
    // 执行全部checkpoint的总时间 ms
    runTimeLimit: integer('run_time_limit').notNull(),
    // 执行全部checkpoint的内存限制 bytes
    runMemoryLimit: integer('run_memory_limit').notNull(),
    // 在这个时间之前不能提交 ISO 8601
    startTime: text('start_time').notNull(),
    // 在这个时间之后不能提交 ISO 8601
    endTime: text('end_time').notNull(),
    // {
    //     "c": "gcc -Wall -Ofast -march=native -mtune=native -std=c23 -DONLINE_JUDGE -o ${output} ${input}",
    //     "cpp": "g++ -Wall -Ofast -march=native -mtune=native -std=c++20 -DONLINE_JUDGE -o ${output} ${input}",
    //     "py": "shebang \"/usr/bin/env python3\" ${input} ${output}",
    //     ...
    // }
    // 上面的shebang表示在文件开头添加一行#!/usr/bin/env python3
    compileCommands: text('compile_commands', { mode: 'json' })
        .$type<Record<string, string>>()
        .notNull(),
    // 一个zip压缩包
    // check0.in.txt
    // check0.out.txt
    // check1.in.bin
    // check1.out.bin
    // check2.in.bin
    // check2.judge
    // metadata.yaml
    //
    // - input: check0.in.txt
    //   output: check0.out.txt
    //   mode: text
    //   note: 对测试点的说明
    // - input: check1.in.bin
    //   output: check1.out.bin
    //   mode: binary
    //   note: 二进制模式
    // - input: check2.in.bin
    //   output: check2.judge
    //   mode: special-judge
    //
    // mode
    // binary 检查正确性时要求内容完全相同
    // text 检查正确性时会忽略换行空格
    // special-judge
    // 使用这个程序检查输出（使用shebang的话，注意必须是LF而不是CRLF）
    // 比如需要实现DSA，由于用到了随机数，签名结果不唯一
    // 可以使用judge验证签名
    // return 0表示正确，1表示错误
    // 调用方式：special-judge input output
    checkpointPath: text('checkpoint_path').notNull(),
});

export const reports = sqliteTable(
    'reports',
    {
        reportid: integer('reportid').primaryKey({ autoIncrement: true }),
        uid: integer('uid')
            .notNull()
            .references(() => users.uid),
        expid: integer('expid')
            .notNull()
            .references(() => experiments.expid),
        reportPath: text('report_path').notNull(),
    },
    row => ({
        unq: unique().on(row.uid, row.expid),
    }),
);

export const submissions = sqliteTable('submissions', {
    subid: integer('subid').primaryKey({ autoIncrement: true }),
    uid: integer('uid')
        .notNull()
        .references(() => users.uid),
    expid: integer('expid')
        .notNull()
        .references(() => experiments.expid),
    // 提交时间 ISO 8601
    submitTime: text('submit_time')
        .$defaultFn(() => new Date().toISOString())
        .notNull(),
    // 是否等待评测（自动搜索pending true的提交进行评测）
    pending: integer('pending', { mode: 'boolean' }).default(true).notNull(),
    // 是否废弃（例如修改了测试点则之前的提交将会无效）
    obsolete: integer('obsolete', { mode: 'boolean' }).default(false).notNull(),
    // 提交的代码
    code: text('code').notNull(),
    // 提交代码的语言（根据这个和对应的实验决定如何编译）
    language: text('language').notNull(),
    // 是否编译成功
    compileSuccess: integer('compile_success', { mode: 'boolean' }),
    // 编译输出
    compileOutput: text('compile_output'),
    // 全部测试点的时间总和 ms
    time: integer('time'),
    // 全部测试点的内存最大值 bytes
    memory: integer('memory'),
    // 是否通过全部测试点
    accepted: integer('accepted', { mode: 'boolean' }),
    // 通过的测试点数量
    acceptedCount: integer('accepted_count'),
    // 每个测试点的执行情况
    result: text('result', { mode: 'json' }).$type<
        {
            time: number;
            memory: number;
            status:
                | 'Accepted'
                | 'Wrong Answer'
                | 'Memory Limit Exceeded'
                | 'Time Limit Exceeded'
                | 'Output Limit Exceeded'
                | 'File Error'
                | 'Nonzero Exit Status'
                | 'Signalled'
                | 'Internal Error';
            stderr: string;
        }[]
    >(),
});
