程序的价值在于「根据情况做不同的事」。本节讲清楚 if/else 的三种形态，以及条件写法上最容易出错的地方。

## 只有一种情况：if

```c
if (score >= 60) {
    printf("及格\n");
}
```

括号里是条件，非 0 为真、0 为假。**注意 C 里没有 boolean 类型（C99 之前）**，条件本质上是一个整数表达式。

这带来一个隐蔽坑：任何非 0 值都算真。

```c
if (x = 5) { ... }    // 赋值，结果是 5，恒为真
if (x) { ... }        // x 非 0 就为真，包括负数
```

判断「有没有」时，`if (count)` 和 `if (count > 0)` 在 `count` 为负数时结论不同。**明确表达意图，写 `> 0`**。

## 两种情况：if/else

```c
if (score >= 60) {
    printf("及格\n");
} else {
    printf("不及格\n");
}
```

`else` 后不要再写条件。如果写 `else (score < 60)` 会编译错误——那个位置只能是语句块。

## 多种情况：else if 链

```c
if (score >= 90) {
    grade = 'A';
} else if (score >= 80) {
    grade = 'B';
} else if (score >= 70) {
    grade = 'C';
} else if (score >= 60) {
    grade = 'D';
} else {
    grade = 'F';
}
```

**关键点：else if 链是自上而下、命中即停。** 所以条件必须从严格到宽松排列。如果把 `>= 60` 放第一个，90 分也会被判成 D。

这个顺序错误是分级逻辑里最常见的 bug，写的时候心里过一遍边界值：90、89、80、60、59 各落在哪一档。

## 大括号不是必须的，但请永远写

C 允许单条语句省略大括号：

```c
if (x > 0)
    printf("正数\n");
```

但下面这种写法会出事：

```c
if (x > 0)
    printf("正数\n");
    printf("这句无论如何都会执行\n");   // 缩进骗人，实际不在 if 里
```

第二行看起来在 if 内部，实际是独立语句。**缩进不改变语义，只有大括号改变**。

历史上出过著名的 `goto fail` 漏洞（Apple SSL），就是因为省略大括号导致一行本该被跳过的代码始终执行。**结论：无论几条语句，一律写大括号。**

## 悬空 else

```c
if (a)
    if (b)
        printf("ab\n");
else
    printf("?\n");     // 这个 else 属于内层 if，不是外层
```

`else` 永远匹配**最近的、未配对的 `if`**。上面的代码里，`a` 为真、`b` 为假时才会打印 `?`。缩进让人误以为是外层。

同样，写大括号就不会有这个歧义。

## 条件的组织方式

**用肯定语句，不用双重否定**

```c
if (!is_not_ready) { ... }     // 差：要绕两圈
if (is_ready) { ... }          // 好
```

**复杂条件拆成有名字的变量**

```c
// 差
if (age >= 18 && age <= 60 && !is_banned && score > 60) { ... }

// 好
int adult = age >= 18 && age <= 60;
int qualified = adult && !is_banned && score > 60;
if (qualified) { ... }
```

变量名就是注释。后面调试时也能直接打印 `adult` 看是哪个条件不满足。

**先处理异常，让主逻辑留在最后**

```c
if (count <= 0) {
    printf("没有数据\n");
    return;
}
// 主逻辑，不用再套一层 if
```

这叫「卫语句」。它能避免三层以上的嵌套——**嵌套超过两层就该重构了**，否则读代码时要不停在脑子里维持上下文。

## 一个完整例子

```c
#include <stdio.h>

int main(void) {
    int score;
    printf("输入成绩：");
    if (scanf("%d", &score) != 1) {
        printf("输入不合法\n");
        return 1;
    }

    if (score < 0 || score > 100) {
        printf("成绩必须在 0-100 之间\n");
        return 1;
    }

    char grade;
    if (score >= 90)      grade = 'A';
    else if (score >= 80) grade = 'B';
    else if (score >= 70) grade = 'C';
    else if (score >= 60) grade = 'D';
    else                  grade = 'F';

    printf("等级：%c\n", grade);
    return 0;
}
```

注意结构：**先校验输入，再处理业务**。这样后面的分级逻辑不需要再考虑 `score` 非法的情况，代码短了，也不容易漏。

## 自查三条

1. `else if` 的条件是从严到宽吗？
2. 每个分支都带大括号吗？
3. 有超过两层的嵌套吗？能不能用卫语句压平？
