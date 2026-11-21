函数是「给一段逻辑起个名字」。有了名字，主程序才能读得像一段说明文，而不是一堆缩进。

## 最小形态

```c
int add(int a, int b) {
    return a + b;
}
```

四要素：

| 位置 | 名称 | 说明 |
|---|---|---|
| `int` | 返回类型 | 返回什么类型；不返回用 `void` |
| `add` | 函数名 | 动词或动宾短语 |
| `(int a, int b)` | 参数列表 | 输入；没有参数写 `(void)` |
| `return a + b;` | 返回语句 | `void` 函数可以不写 |

调用：

```c
int s = add(3, 5);        // s = 8
```

## 先声明后使用

C 编译器从上往下扫。如果在定义之前就调用，必须提前声明（原型）：

```c
int add(int a, int b);    // 声明：只写类型和名字，不写函数体

int main(void) {
    printf("%d\n", add(3, 5));
    return 0;
}

int add(int a, int b) {   // 定义
    return a + b;
}
```

**声明和定义的区别**：声明是「有这么个函数，长这样」，定义是「它具体做什么」。编译器看到声明就允许调用，具体地址在链接阶段补上。

这就是为什么多个 `.c` 文件协作时，函数声明都放在 `.h` 头文件里——每个文件 `#include` 一下就知道有哪些函数可用。

## 参数是按值传递

这是 C 最重要的机制之一，必须现在理解清楚。

```c
void try_change(int x) {
    x = 999;              // 只改了副本
}

int main(void) {
    int a = 5;
    try_change(a);
    printf("%d\n", a);    // 仍然输出 5
}
```

**函数收到的是实参的副本。** 改副本不影响原件。

推论：**想在函数里修改调用者的变量，必须传地址（指针）**。

```c
void really_change(int *p) {
    *p = 999;             // 通过地址改原件
}

int main(void) {
    int a = 5;
    really_change(&a);
    printf("%d\n", a);    // 输出 999
}
```

这个区别决定了后面所有「用函数交换两个数」「用函数往数组里填数据」的写法。现在记牢：**值传递 = 副本，改不到原件**。

## 返回值只能有一个

```c
int divide(int a, int b, int *ok) {     // 商用返回值，状态用指针带回
    if (b == 0) {
        *ok = 0;
        return 0;
    }
    *ok = 1;
    return a / b;
}
```

C 不支持返回多个值。需要带回多个结果时有两种办法：

1. **用指针参数**（如上），把额外的结果写进调用者的变量
2. **返回结构体**，把多个值打包

```c
typedef struct { int q; int r; } DivResult;

DivResult divide(int a, int b) {
    DivResult res;
    res.q = a / b;
    res.r = a % b;
    return res;
}
```

第二种更清晰，但需要先理解结构体（第 4 章）。现阶段用第一种就够。

## void 的两种用法

```c
void print_banner(void) {      // 不返回任何值
    printf("=====\n");
}

int read_int(void) {           // 不接收参数，但返回 int
    int x;
    scanf("%d", &x);
    return x;
}
```

**`void` 在参数位置表示「不接收参数」，在返回位置表示「不返回」**。两处可以独立出现。

## 函数名怎么起

**用动词开头，说明「做什么」而不是「怎么做的」**：

```c
int  is_prime(int n);              // 好：返回真假
int  sum_array(int a[], int n);    // 好：动宾
void sort_desc(int a[], int n);    // 好：动宾 + 方向

int  calc(int a, int b);           // 差：calc 什么都算
int  func1(int x);                 // 差：无意义
```

返回布尔的函数用 `is_` / `has_` 开头，这是跨语言的通用惯例，一眼就能看出返回什么。

## 一个完整例子：把素数判断提成函数

```c
#include <stdio.h>
#include <math.h>

/* 返回 1 表示素数，0 表示不是；n < 2 一律不是 */
int is_prime(int n) {
    if (n < 2) return 0;
    for (int i = 2; i <= (int)sqrt((double)n); i++) {
        if (n % i == 0) return 0;
    }
    return 1;
}

int main(void) {
    int count = 0;
    for (int n = 2; n <= 100; n++) {
        if (is_prime(n)) {
            printf("%3d", n);
            if (++count % 10 == 0) printf("\n");
        }
    }
    printf("\n共 %d 个\n", count);
    return 0;
}
```

好处很直接：`main` 里只剩「从 2 到 100 遍历，是素数就打印」，素数怎么判断的细节被名字挡住了。**要改判断逻辑，只改一个地方**。

## 常见错误

| 错误 | 原因 |
|---|---|
| `undefined reference to 'add'` | 只有声明没有定义，或没参与编译 |
| `implicit declaration of function` | 调用前没声明，且没 include 头文件 |
| 函数改了参数但调用者没变 | 忘了传地址，或者忘了解引用 |
| `control reaches end of non-void function` | 有分支漏了 return |

最后一条特别容易漏：函数声明返回 `int`，但某条分支没写 `return`，函数会返回一个垃圾值。

```c
int check(int x) {
    if (x > 0) return 1;
    // x <= 0 时这里没有 return，返回值不确定
}
```

**解决办法：让每个分支都 return，或者在末尾统一 return。**

## 自查

1. 函数名前有声明吗（如果定义在后面）？
2. 想在函数里改变量，传的是地址还是值？
3. 每个非 void 函数的所有分支都有 return 吗？
4. 函数名能看出它做什么吗？
