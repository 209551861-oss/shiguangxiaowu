循环让程序重复做一件事。C 有三种循环，各自适合不同的场景，选错了代码会变得别扭。

## while：不知道要循环多少次时用它

```c
int n = 0;
while (n < 5) {
    printf("%d\n", n);
    n++;
}
```

结构是「先判断，再执行」。条件一开始就不成立时，循环体一次都不执行。

**典型场景**：读输入直到结束、等待某个状态变化。

```c
int x;
while (scanf("%d", &x) == 1) {
    printf("读到 %d\n", x);
}
```

这里循环次数取决于输入有几个数，事先不知道，`while` 最自然。

## do-while：至少要执行一次时用它

```c
int choice;
do {
    printf("1.开始 2.退出\n");
    scanf("%d", &choice);
} while (choice != 2);
```

**先执行，再判断**。所以循环体至少跑一次。

这是它和 `while` 唯一但重要的区别。菜单就是典型场景：菜单必须先显示出来，用户才可能选。

注意结尾的分号：`} while (...);` 这里**必须有分号**，漏了会编译报错，且报错位置常常指向下一行，容易看错。

## for：次数已知时用它

```c
for (int i = 0; i < 5; i++) {
    printf("%d\n", i);
}
```

三个部分：初始化、条件、每轮结束后执行。

`for` 的好处是**把循环控制集中在一行**，读代码时一眼能看到起点、终点、步长。所以只要循环次数是已知的，优先用 `for`。

```c
for (int i = 1; i <= 100; i++) { ... }      // 1 到 100
for (int i = 0; i < n; i++) { ... }         // 数组遍历，标准写法
for (int i = 10; i > 0; i--) { ... }        // 倒着数
for (int i = 0; i < n; i += 2) { ... }      // 步长 2
```

`int i` 写在 `for` 里是 C99 的写法，作用域仅限于循环内。如果编译器报错说 `for` 里不能声明变量，说明在用很老的 C 标准，加 `-std=c99` 或把 `i` 提到外面。

## break 和 continue

**`break` 直接跳出整个循环**：

```c
for (int i = 0; i < 100; i++) {
    if (a[i] == target) {
        printf("找到了，下标 %d\n", i);
        break;                 // 找到就不再继续
    }
}
```

**`continue` 跳过本轮剩余部分，直接进入下一轮**：

```c
for (int i = 0; i < n; i++) {
    if (a[i] < 0) continue;    // 负数不参与累加
    sum += a[i];
}
```

区别记法：`break` 是「不干了」，`continue` 是「这个不算，下一个」。

## 嵌套循环

```c
for (int i = 1; i <= 3; i++) {
    for (int j = 1; j <= 4; j++) {
        printf("%d*%d=%-3d ", i, j, i * j);
    }
    printf("\n");
}
```

外层跑 3 次，内层跑 4 次，总共 3 × 4 = 12 次。

**关键：`break` 只能跳出它所在的那一层**。内层 `break` 不影响外层。

```c
for (int i = 0; i < 3; i++) {
    for (int j = 0; j < 3; j++) {
        if (j == 1) break;     // 只跳出内层，外层继续
    }
}
```

要跳出多层，常见做法是用一个标志变量，或者把循环封成函数用 `return`：

```c
int found = 0;
for (int i = 0; i < n && !found; i++) {
    for (int j = 0; j < m; j++) {
        if (a[i][j] == target) { found = 1; break; }
    }
}
```

注意外层条件里的 `&& !found`，这是让外层也跟着停的常用写法。

## 三种循环的等价关系

任何 `for` 都能改写成 `while`：

```c
for (int i = 0; i < 5; i++) { body; }

// 等价于
int i = 0;
while (i < 5) { body; i++; }
```

理解这个等价关系很重要：**`for` 不是新东西，只是把 while 的三段控制收纳到一行**。遇到想不清楚的 `for`，手动展开成 `while` 看，立刻就清楚了。

## 一个完整例子：判断素数

```c
#include <stdio.h>
#include <math.h>

int main(void) {
    int n;
    printf("输入一个正数：");
    if (scanf("%d", &n) != 1 || n < 2) {
        printf("请输入大于 1 的整数\n");
        return 1;
    }

    int is_prime = 1;
    for (int i = 2; i <= (int)sqrt((double)n); i++) {
        if (n % i == 0) {
            is_prime = 0;
            break;                 // 找到因子就够了
        }
    }

    printf("%d %s素数\n", n, is_prime ? "是" : "不是");
    return 0;
}
```

三个值得注意的点：

1. 循环到 `sqrt(n)` 就够，不用到 `n-1`——如果 `n` 有因子，必有一个不超过根号 n
2. `sqrt` 要 `#include <math.h>`，编译加 `-lm`
3. 找到因子立刻 `break`，不做无用功

## 自查

1. 次数已知用 `for`，次数未知用 `while`，至少执行一次用 `do-while`——选对了吗？
2. `do-while` 结尾的分号写了吗？
3. 嵌套循环里想跳出多层，是不是只跳了一层？
