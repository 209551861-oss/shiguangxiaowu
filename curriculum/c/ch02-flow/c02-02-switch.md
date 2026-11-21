当判断依据是「一个值等于哪几种情况之一」时，`switch` 比一长串 `else if` 更清楚。

但它有两个必须记住的坑：`break` 漏写会导致穿透，`case` 只接受整型常量。

## 基本形态

```c
switch (choice) {
    case 1:
        printf("新建\n");
        break;
    case 2:
        printf("打开\n");
        break;
    case 3:
        printf("退出\n");
        break;
    default:
        printf("无效选项\n");
        break;
}
```

括号里必须是**整型表达式**（`int`、`char`、枚举）。浮点、字符串都不行。

`case` 后面必须是**编译期常量**，不能是变量：

```c
int n = 2;
case n:      // 错：case 标签必须是常量
case 2:      // 对
```

## break 的作用：跳出 switch

**漏写 `break` 会「穿透」到下一个 case**，继续执行后面的语句，直到遇到 `break` 或 switch 结束。

```c
switch (n) {
    case 1:
        printf("一\n");     // 没有 break
    case 2:
        printf("二\n");
        break;
}
// n = 1 时输出：一 二
```

穿透在绝大多数情况下是 bug。但如果**故意利用**，可以让多个 case 共享一段逻辑：

```c
switch (grade) {
    case 'A':
    case 'B':
        printf("优秀\n");
        break;
    case 'C':
        printf("及格\n");
        break;
    default:
        printf("需努力\n");
        break;
}
```

这种写法是合法的、常见的。判断标准是：**空 case 连续排列是共享，有语句还往下掉就是漏写 break**。

建议在最后一个 `case` 或 `default` 也写 `break`。虽然语法上不需要，但以后在下面追加分支时不会因为漏改而出错。

## default 的位置

`default` 可以写在任意位置，但**建议写在最后**，符合阅读习惯。

`default` 不是必须的，但**强烈建议保留**。它的作用是兜住所有没匹配的值——没有它，非法输入会静默地什么也不做，这种 bug 最难查。

## switch 与 if 怎么选

**用 switch 的场景**：一个变量，与若干个具体值比较，分支 3 个以上。

**用 if 的场景**：范围判断（`score >= 60`）、多个不同变量组合、逻辑条件。

```c
// switch 合适：判断具体值
switch (month) {
    case 2: days = 28; break;
    case 4: case 6: case 9: case 11: days = 30; break;
    default: days = 31;
}

// if 合适：范围
if (score >= 90) { ... }
```

## 用枚举代替魔法数字

`case 1 / case 2 / case 3` 读到第三周就忘了每个数字是什么意思。用枚举：

```c
enum Menu { MENU_NEW = 1, MENU_OPEN, MENU_QUIT };

switch (choice) {
    case MENU_NEW:  printf("新建\n"); break;
    case MENU_OPEN: printf("打开\n"); break;
    case MENU_QUIT: printf("退出\n"); break;
    default:        printf("无效选项\n"); break;
}
```

枚举的值默认从 0 递增，这里显式从 1 开始，和菜单编号对齐。**用枚举后，case 标签自带语义**，也不需要担心数字改了忘了改 case。

## 一个完整例子：简易计算器

```c
#include <stdio.h>

int main(void) {
    double a, b;
    char op;

    printf("输入算式（如 3 + 5）：");
    if (scanf("%lf %c %lf", &a, &op, &b) != 3) {
        printf("格式不对\n");
        return 1;
    }

    switch (op) {
        case '+': printf("%.2f\n", a + b); break;
        case '-': printf("%.2f\n", a - b); break;
        case '*': printf("%.2f\n", a * b); break;
        case '/':
            if (b == 0.0) {
                printf("除数不能为 0\n");
            } else {
                printf("%.2f\n", a / b);
            }
            break;
        default:
            printf("不支持的运算符：%c\n", op);
            break;
    }
    return 0;
}
```

注意 `case '/'` 里面套了 if——switch 里完全可以有 if，两者不冲突。除法必须先判零，这是运行时会崩的地方。

## 常见错误清单

| 现象 | 原因 |
|---|---|
| 打印了两个分支的结果 | 漏 `break` |
| `error: case label does not reduce to an integer constant` | case 用了变量 |
| 非法输入什么都没输出 | 没写 `default` |
| `error: duplicate case value` | 两个 case 值相同 |
| 浮点做 switch 报错 | switch 不接受浮点 |

## 自查

1. 每个 `case` 都有 `break` 吗（除了故意共享的空 case）？
2. 有 `default` 吗？
3. `case` 里的数字有没有换成枚举？
