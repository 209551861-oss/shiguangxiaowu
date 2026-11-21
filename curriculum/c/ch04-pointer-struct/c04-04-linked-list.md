链表是「用指针把散落的内存串起来」。数组要求元素连续存放，链表不要求——每个节点记着下一个在哪。

这一节把建立、遍历、插入、删除四件事写完，并讲清最容易出错的两个地方：头指针的修改、释放后的野指针。

## 节点怎么定义

```c
typedef struct Node {
    int          data;
    struct Node *next;      // 指向同类型的下一个节点
} Node;
```

**关键点：`next` 的类型是 `struct Node *`，不是 `Node *`。**

因为在定义结构体的过程中，`Node` 这个 typedef 名字还没生效，只能用 `struct Node`。这是 C 的语法限制，记住这个写法就行。

## 头指针与空链表

```c
Node *head = NULL;          // 空链表：头指针为 NULL
```

**链表用「头指针」表示。头指针为 `NULL` 就是空链表。**

这一点非常重要：所有操作都必须考虑 `head == NULL` 的情况。

## 建立节点

```c
#include <stdlib.h>

Node *create_node(int value) {
    Node *p = (Node *)malloc(sizeof(Node));
    if (p == NULL) {
        printf("内存分配失败\n");
        return NULL;
    }
    p->data = value;
    p->next = NULL;
    return p;
}
```

三个要点：

1. `malloc` 返回 `void *`，要强转成 `Node *`
2. **`malloc` 可能失败**（内存不足），必须检查 `NULL`
3. 新节点的 `next` 一定设为 `NULL`，否则是野指针

## 遍历

```c
void print_list(Node *head) {
    for (Node *p = head; p != NULL; p = p->next) {
        printf("%d -> ", p->data);
    }
    printf("NULL\n");
}
```

**固定模式：从 `head` 开始，`p != NULL` 时继续，每步 `p = p->next`。**

三个容易写错的地方：

- 条件写成 `p->next != NULL`：会漏掉最后一个节点
- 忘了 `p = p->next`：死循环
- 用 `p++`：链表节点不连续，必须用 `p = p->next`

## 头插法：每次插到最前面

```c
Node *push_front(Node *head, int value) {
    Node *p = create_node(value);
    if (p == NULL) return head;
    p->next = head;         // 新节点指向原头
    return p;               // 新节点成为新头
}
```

**注意返回值：头指针变了，必须返回新的头，调用方要接住。**

```c
head = push_front(head, 10);
```

忘了 `head = ` 是最常见的错误——链表建好了，但头指针还指着旧的，前面插入的全丢了。

## 尾插法：保持顺序

```c
Node *push_back(Node *head, int value) {
    Node *p = create_node(value);
    if (p == NULL) return head;

    if (head == NULL) return p;      // 空链表：新节点就是头

    Node *cur = head;
    while (cur->next != NULL) cur = cur->next;   // 走到最后一个
    cur->next = p;
    return head;
}
```

**尾插必须处理空链表的特例**，否则 `cur = head` 是 `NULL`，`cur->next` 当场崩溃。

这个「空链表特判」是链表代码里最高频的 bug 来源。

## 在指定位置插入

```c
/* 在下标 pos 处插入；pos=0 等价于头插 */
Node *insert_at(Node *head, int pos, int value) {
    if (pos <= 0) return push_front(head, value);

    Node *cur = head;
    for (int i = 0; i < pos - 1 && cur != NULL; i++) {
        cur = cur->next;
    }
    if (cur == NULL) {
        printf("位置 %d 超出链表长度\n", pos);
        return head;
    }

    Node *p = create_node(value);
    if (p == NULL) return head;
    p->next = cur->next;
    cur->next = p;
    return head;
}
```

**插入顺序不能反**：

```c
p->next = cur->next;      // 先让新节点接上后面
cur->next = p;            // 再让前面接上新节点
```

如果反过来先写 `cur->next = p`，`cur->next` 原来的值就丢了，后面的整条链表断掉。

**这是链表最经典的错误，务必记住顺序：先接后，再接前。**

## 删除节点

```c
Node *remove_value(Node *head, int value) {
    if (head == NULL) return NULL;

    if (head->data == value) {          // 特殊情况：删的是头
        Node *next = head->next;
        free(head);
        return next;
    }

    Node *cur = head;
    while (cur->next != NULL && cur->next->data != value) {
        cur = cur->next;
    }
    if (cur->next != NULL) {            // 找到了
        Node *victim = cur->next;
        cur->next = victim->next;
        free(victim);
    }
    return head;
}
```

**删除必须「先保存、再摘链、最后释放」**：

```c
Node *victim = cur->next;
cur->next = victim->next;    // 先摘链
free(victim);                // 再释放
```

如果先 `free` 再访问 `victim->next`，就是访问已释放内存（use-after-free），行为未定义。

**删头节点必须单独处理**，因为头没有「前一个节点」。这也是链表常见的分支。

## 释放整条链表

```c
void free_list(Node *head) {
    Node *p = head;
    while (p != NULL) {
        Node *next = p->next;    // 先记住下一个
        free(p);                 // 再释放当前
        p = next;
    }
}
```

**顺序关键**：`free(p)` 之后 `p->next` 就已经失效了，所以必须先把 `next` 存下来。

写成 `free(p); p = p->next;` 是错的——释放后再读 `p->next`。

## 一个完整可跑的例子

```c
#include <stdio.h>
#include <stdlib.h>

typedef struct Node {
    int data;
    struct Node *next;
} Node;

Node *create_node(int v) {
    Node *p = malloc(sizeof(Node));
    if (!p) return NULL;
    p->data = v;
    p->next = NULL;
    return p;
}

Node *push_back(Node *head, int v) {
    Node *p = create_node(v);
    if (!p) return head;
    if (!head) return p;
    Node *cur = head;
    while (cur->next) cur = cur->next;
    cur->next = p;
    return head;
}

void print_list(Node *head) {
    for (Node *p = head; p; p = p->next) printf("%d -> ", p->data);
    printf("NULL\n");
}

void free_list(Node *head) {
    while (head) {
        Node *next = head->next;
        free(head);
        head = next;
    }
}

int main(void) {
    Node *head = NULL;
    for (int i = 1; i <= 5; i++) head = push_back(head, i);
    print_list(head);          // 1 -> 2 -> 3 -> 4 -> 5 -> NULL
    free_list(head);
    return 0;
}
```

## 链表 vs 数组

| 操作 | 数组 | 链表 |
|---|---|---|
| 按下标访问 | O(1) | O(n)，必须从头走 |
| 头部插入 | O(n)，要搬数据 | O(1) |
| 中间插入 | O(n)，要搬数据 | O(n) 找位置，插入本身 O(1) |
| 内存 | 连续，容量固定 | 分散，按需分配 |

**结论：频繁在头部插入删除、长度不定 → 链表；频繁随机访问 → 数组。** 绝大多数业务场景数组更好（缓存友好），链表的价值在于理解指针和应对特定结构。

## 自查

1. 空链表（`head == NULL`）的情况处理了吗？
2. 插入时是「先接后，再接前」吗？
3. 删除时是「先摘链，再 free」吗？
4. 释放整表时先存了 `next` 吗？
5. 改了头指针的地方，返回值接住了吗？
