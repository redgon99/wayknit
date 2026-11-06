-- 외국인 가이드 남은 번역 (2026-10-27) — Supabase SQL Editor에 붙여넣어 한 번에 실행.
-- 기존 번역은 그대로 두고(|| 병합) 빠진 언어만 추가한다. 여러 번 실행해도 결과는 같다.

-- 1) 대중교통 — es
update guide_articles set translations = translations || jsonb_build_object(
'es', jsonb_build_object('title', $t$Cómo moverse por Corea en transporte público — Guía para viajeros extranjeros$t$, 'summary', $t$Metro, autobús y taxi con una sola tarjeta T-money: así funciona el transporte público en Corea.$t$, 'bodyMd', $t$## Consigue primero una tarjeta T-money
- Puedes comprar y recargar la tarjeta T-money en cualquier tienda de conveniencia (GS25, CU, 7-Eleven).
- Con una sola tarjeta pagas metro, autobús y taxi, y los descuentos por transbordo se aplican automáticamente.

## Del aeropuerto a la ciudad
- Aeropuerto de Incheon → Estación de Seúl: el tren AREX Express es la opción más rápida (unos 43 minutos).
- Los autobuses limusina del aeropuerto te llevan a los principales hoteles y barrios con asiento garantizado.

## Metro
- La señalización y los mapas están en inglés, chino y japonés. Para orientarte dentro de Corea, Naver Map y Kakao Map son mucho más precisos que Google Maps.
- Comprueba la hora del último tren: la mayoría de las líneas dejan de funcionar alrededor de la medianoche.

## Taxi
- La app Kakao T funciona bien para extranjeros (interfaz en inglés y admite tarjetas de crédito internacionales).
- Entre la medianoche y las 4 de la mañana se aplica un recargo nocturno.

## Autobús
- Las pantallas de las paradas muestran la llegada en tiempo real.
- Se sube por delante y se baja por detrás; vuelve a pasar la tarjeta al bajar o podrías perder el descuento por transbordo o pagar de más.
$t$)
) where slug = 'foreigner-korea-public-transport';

-- 2) 문화·에티켓 — zh-CN, zh-TW, fr
update guide_articles set translations = translations || jsonb_build_object(
'zh-CN', jsonb_build_object('title', $t$韩国旅行前值得了解的文化与礼仪$t$, 'summary', $t$什么时候要脱鞋?需要给小费吗?韩国旅行中容易忽略的文化小贴士。$t$, 'bodyMd', $t$## 没有小费文化
- 在餐厅、出租车和酒店一般都不给小费,对方反而可能会感到尴尬,甚至把钱退回来。

## 需要脱鞋的地方
- 席地而坐的韩餐馆、民宿、汗蒸幕(桑拿)和传统韩屋住宿,大多要在门口脱鞋。
- 咖啡馆和一般餐厅不用脱鞋。

## 用餐礼仪
- 等长辈先拿起勺子或筷子再开始用餐是一种礼貌。
- 倒酒时用双手;和长辈喝酒时,习惯把头稍微转向一侧再喝。
- 饭碗放在桌上吃,不要端起来。

## 公共交通礼仪
- 地铁上的孕妇及老弱专座,即使空着一般也不会去坐。
- 乘扶梯时排成一列,把一侧留给赶时间的人。

## 问候与称呼
- 初次见面时轻轻点头致意。韩国有根据年龄和职位使用敬语的文化,对外国人也大多使用敬语。
$t$),
'zh-TW', jsonb_build_object('title', $t$韓國旅行前值得了解的文化與禮儀$t$, 'summary', $t$什麼時候要脫鞋?需要給小費嗎?韓國旅行中容易忽略的文化小提醒。$t$, 'bodyMd', $t$## 沒有小費文化
- 在餐廳、計程車和飯店一般都不給小費,對方反而可能覺得尷尬,甚至把錢退回來。

## 需要脫鞋的地方
- 席地而坐的韓式餐廳、民宿、汗蒸幕(三溫暖)和傳統韓屋住宿,大多要在門口脫鞋。
- 咖啡廳和一般餐廳不用脫鞋。

## 用餐禮儀
- 等長輩先拿起湯匙或筷子再開始用餐,是一種禮貌。
- 倒酒時用雙手;和長輩喝酒時,習慣把頭稍微轉向一側再喝。
- 飯碗放在桌上吃,不要端起來。

## 大眾運輸禮儀
- 地鐵上的孕婦及博愛座,即使空著一般也不會去坐。
- 搭手扶梯時排成一列,把一側留給趕時間的人。

## 問候與稱呼
- 初次見面時輕輕點頭致意。韓國有依年齡和職位使用敬語的文化,對外國人也多半使用敬語。
$t$),
'fr', jsonb_build_object('title', $t$Culture et savoir-vivre coréens à connaître avant de partir$t$, 'summary', $t$Quand faut-il enlever ses chaussures ? Faut-il laisser un pourboire ? Les conseils culturels faciles à oublier en Corée.$t$, 'bodyMd', $t$## Pas de culture du pourboire
- Le pourboire n'est pas attendu au restaurant, en taxi ni à l'hôtel. Le personnel peut être gêné, voire vous rendre l'argent.

## Où enlever ses chaussures
- Dans les restaurants coréens où l'on s'assoit au sol, les guesthouses, les jjimjilbang (bains publics) et les hébergements traditionnels hanok, on retire généralement ses chaussures à l'entrée.
- Dans les cafés et les restaurants classiques, vous pouvez les garder.

## Bonnes manières à table
- Il est poli d'attendre que la personne la plus âgée prenne sa cuillère ou ses baguettes avant de commencer à manger.
- Servez à boire avec les deux mains et, lorsque vous buvez avec une personne plus âgée, tournez légèrement la tête.
- Le bol de riz reste sur la table : on ne le porte pas à la bouche.

## Dans les transports en commun
- Les places réservées aux femmes enceintes et aux personnes âgées restent généralement libres, même quand le métro est bondé.
- Sur les escalators, tenez-vous en file et laissez un côté libre pour les personnes pressées.

## Salutations et politesse
- Une légère inclinaison de la tête est la salutation habituelle lors d'une rencontre. Le coréen comporte des niveaux de politesse selon l'âge et le statut, et l'on s'adresse généralement aux visiteurs étrangers de manière polie.
$t$)
) where slug = 'foreigner-korea-etiquette';

-- 3) 식당 이용 — fr, de
update guide_articles set translations = translations || jsonb_build_object(
'fr', jsonb_build_object('title', $t$Manger au restaurant en Corée — Guide pour les visiteurs étrangers$t$, 'summary', $t$Pourquoi les accompagnements sont-ils gratuits ? Peut-on manger du crabe royal seul ? Conseils pratiques pour les restaurants coréens.$t$, 'bodyMd', $t$## Les accompagnements (banchan) sont gratuits et resservis
- Quand vous commandez un plat principal, le kimchi et d'autres accompagnements sont servis d'office, et la plupart des restaurants les resservent gratuitement.
- Dites « banchan deo juseyo » (encore des accompagnements, s'il vous plaît) ou montrez simplement le plat vide : le personnel comprendra.

## Comment commander
- De nombreux restaurants prennent désormais les commandes sur tablette ou borne, et la plupart ont un bouton EN/English.
- Beaucoup d'établissements ont un bouton d'appel sur la table pour faire venir le personnel.

## Manger seul
- Même les plats traditionnellement partagés, comme le crabe dans les restaurants de fruits de mer de Busan, sont de plus en plus proposés en formule individuelle : demandez « C'est possible pour une personne ? » avant de réserver ou d'entrer.
- Beaucoup de barbecues coréens (poitrine de porc, côtes de bœuf) imposent une commande minimum de deux portions. Les adresses qui acceptent les clients seuls affichent souvent « 1인분 가능 » (portion individuelle possible) sur l'enseigne ou la carte.
- Les restaurants de gukbap (soupe au riz) et de haejangguk (soupe « anti-gueule de bois ») ouverts 24 h/24 accueillent traditionnellement très bien les clients seuls.

## Applications de réservation et de file d'attente
- Les restaurants populaires prennent les réservations via Naver Reservation ou l'application CatchTable, toutes deux disponibles en anglais.
- Sans réservation, il y a souvent une tablette à l'entrée (comme Tabling) pour s'inscrire dans la file et recevoir un message quand c'est votre tour.
- Les files peuvent être longues : évitez les heures de pointe (12 h–13 h et 18 h–19 h).

## Manger tard le soir
- En centre-ville, vous trouverez des restaurants de budae-jjigae, de gukbap et de snacks ouverts après minuit. Filtrez par « 24 heures » sur Naver Map pour les trouver facilement.

## Régimes alimentaires
- Si vous êtes végétarien, sans gluten ou allergique, consultez notre guide dédié aux voyageurs végétariens, sans gluten et allergiques : il aborde le sujet bien plus en détail.

## Applications de livraison
- Les principales sont Baemin et Coupang Eats. Certaines n'acceptent pas les cartes étrangères : demander à la réception de l'hôtel de commander pour vous est une bonne solution de repli.
$t$),
'de', jsonb_build_object('title', $t$Essen gehen in Korea — Ein Restaurant-Leitfaden für ausländische Gäste$t$, 'summary', $t$Warum sind die Beilagen kostenlos? Kann man allein Königskrabbe essen? Praktische Tipps für koreanische Restaurants.$t$, 'bodyMd', $t$## Beilagen (Banchan) sind kostenlos und werden nachgefüllt
- Wenn Sie ein Hauptgericht bestellen, kommen Kimchi und weitere Beilagen automatisch dazu, und die meisten Lokale füllen sie kostenlos nach.
- Sagen Sie „banchan deo juseyo“ (mehr Beilagen, bitte) oder zeigen Sie einfach den leeren Teller – das Personal versteht Sie.

## So bestellen Sie
- Viele Restaurants nehmen Bestellungen inzwischen per Tablet oder Kiosk auf, und die meisten haben eine EN/English-Taste.
- In vielen Lokalen gibt es einen Rufknopf am Tisch, um das Personal zu holen.

## Allein essen
- Selbst Gerichte, die man traditionell in der Gruppe teilt – etwa Krabben in Busans Meeresfrüchte-Restaurants –, gibt es zunehmend als Einzelportion. Fragen Sie vor der Reservierung oder beim Eintreten: „Geht das auch für eine Person?“
- Viele koreanische BBQ-Restaurants (Schweinebauch, Rinderrippen) verlangen eine Mindestbestellung von zwei Portionen. Lokale, die Einzelgäste bedienen, weisen oft mit „1인분 가능“ (Einzelportion möglich) am Schild oder auf der Karte darauf hin.
- Rund um die Uhr geöffnete Gukbap- (Reissuppe) und Haejangguk-Lokale („Katersuppe“) sind traditionell sehr offen für Alleinessende.

## Reservierungs- und Warteliste-Apps
- Beliebte Restaurants nehmen Reservierungen über Naver Reservation oder die App CatchTable an – beide gibt es auf Englisch.
- Ohne Reservierung steht oft ein Tablet am Eingang (z. B. Tabling), an dem Sie sich in die Warteschlange eintragen und eine Nachricht erhalten, sobald Sie an der Reihe sind.
- Die Schlangen können lang sein; es hilft, die Stoßzeiten (12–13 Uhr und 18–19 Uhr) zu meiden.

## Essen spät in der Nacht
- In den Stadtzentren haben Budae-Jjigae-, Gukbap- und Snack-Lokale oft auch nach Mitternacht geöffnet. Mit dem Filter „24 Stunden“ in Naver Map finden Sie sie leicht.

## Ernährungseinschränkungen
- Wenn Sie vegetarisch oder glutenfrei essen oder Allergien haben, lesen Sie unseren eigenen Leitfaden für vegetarische, glutenfreie und allergiebewusste Reisende – dort wird das Thema viel ausführlicher behandelt.

## Liefer-Apps
- Die wichtigsten sind Baemin und Coupang Eats. Manche Apps akzeptieren keine ausländischen Karten; dann können Sie die Hotelrezeption bitten, für Sie zu bestellen.
$t$)
) where slug = 'foreigner-korea-dining-guide';

-- 4) 면세·쇼핑 — es, fr
update guide_articles set translations = translations || jsonb_build_object(
'es', jsonb_build_object('title', $t$Compras libres de impuestos en Corea — Guía para turistas extranjeros$t$, 'summary', $t$¿Cómo funciona la devolución de impuestos? Consejos prácticos de compras, de las tiendas de conveniencia a los mercados tradicionales.$t$, 'bodyMd', $t$## Devolución inmediata vs. devolución al salir del país
- Las compras que superan un importe mínimo en una misma tienda (normalmente 30.000 ₩) dan derecho a la devolución de impuestos. Busca la pegatina "Tax Refund" en la tienda.
- Puedes solicitar la devolución en los quioscos automáticos de la zona de salidas del aeropuerto con tu pasaporte y los recibos; deja tiempo de sobra antes de embarcar.

## Dónde comprar
- Cosmética y artículos de uso diario: Olive Young es muy popular y ofrece cupones de descuento exclusivos para extranjeros en su app y en tienda.
- Mercados tradicionales (Gwangjang, Namdaemun y otros): pagar en efectivo suele salir mejor, y en algunos puestos se puede regatear.
- Tiendas de conveniencia: abiertas 24 horas, ideales para pequeños recuerdos, aperitivos y recargar la tarjeta de transporte.

## Consejos de pago
- Las tarjetas físicas y el efectivo siguen siendo más aceptados que Samsung Pay o Apple Pay.
- Algunas tiendas pequeñas pueden rechazar tarjetas emitidas en el extranjero, así que conviene llevar algo de efectivo.
$t$),
'fr', jsonb_build_object('title', $t$Shopping détaxé en Corée — Guide pour les touristes étrangers$t$, 'summary', $t$Comment fonctionne la détaxe ? Conseils shopping pratiques, des supérettes aux marchés traditionnels.$t$, 'bodyMd', $t$## Détaxe immédiate ou remboursement au départ
- Les achats dépassant un certain montant dans un même magasin (généralement 30 000 ₩) donnent droit à la détaxe. Repérez l'autocollant « Tax Refund » en magasin.
- Vous pouvez obtenir le remboursement aux bornes automatiques de la zone de départ de l'aéroport avec votre passeport et vos reçus — prévoyez largement le temps avant l'embarquement.

## Où faire ses achats
- Cosmétiques et produits du quotidien : Olive Young est très populaire et propose des coupons de réduction réservés aux étrangers dans son application et en magasin.
- Marchés traditionnels (Gwangjang, Namdaemun, etc.) : payer en espèces est souvent plus avantageux, et certains stands acceptent le marchandage.
- Supérettes : ouvertes 24 h/24, pratiques pour les petits souvenirs, les en-cas et la recharge de la carte de transport.

## Conseils de paiement
- Les cartes physiques et les espèces restent plus largement acceptées que Samsung Pay ou Apple Pay.
- Certaines petites boutiques peuvent refuser les cartes émises à l'étranger : mieux vaut avoir un peu d'argent liquide.
$t$)
) where slug = 'foreigner-korea-tax-refund-shopping';

-- 5) 입국 체크리스트 — fr
update guide_articles set translations = translations || jsonb_build_object(
'fr', jsonb_build_object('title', $t$Arriver en Corée — La check-list avant le départ pour les voyageurs étrangers$t$, 'summary', $t$Du visa au change en passant par la carte SIM : tout ce qu'il faut régler avant d'atterrir en Corée.$t$, 'bodyMd', $t$## Vérifiez votre visa
- Même les ressortissants des pays bénéficiant d'une exemption de visa de 90 jours (États-Unis, Canada, une grande partie de l'Europe, etc.) doivent généralement demander au préalable une K-ETA (autorisation électronique de voyage). Faites la demande en ligne au moins 72 heures avant le départ.
- Votre passeport doit être valide au moins six mois après la date d'entrée.

## Argent et moyens de paiement
- Les bureaux de change en ville, par exemple à Myeong-dong, offrent souvent de meilleurs taux que ceux de l'aéroport.
- Le paiement par carte est courant, mais certains marchés traditionnels et petits restaurants n'acceptent que les espèces.
- Les cartes Visa et Mastercard émises à l'étranger fonctionnent dans la plupart des commerces.

## SIM et eSIM
- Vous pouvez acheter une carte SIM ou une eSIM directement dans le hall des arrivées de l'aéroport d'Incheon.
- Si votre téléphone est compatible eSIM, l'acheter en ligne avant de partir vous permet d'être connecté dès l'atterrissage.

## Assurance voyage
- Nous vous conseillons de souscrire une assurance voyage avant le départ. Les frais médicaux des étrangers non assurés peuvent être élevés.

## Check-list des bagages
- Les batteries externes sont interdites en soute : gardez-les toujours en cabine.
- Un adaptateur de prise (la Corée utilise du 220 V avec des prises de type C/F).
- Des médicaments de base et, si nécessaire, une ordonnance ou un certificat médical en anglais.
$t$)
) where slug = 'foreigner-korea-arrival-checklist';

-- 6) 응급상황 — 8개 언어 전부
update guide_articles set translations = coalesce(translations, '{}'::jsonb) || jsonb_build_object(
'en', jsonb_build_object('title', $t$Handling Emergencies While Traveling in Korea$t$, 'summary', $t$Hurt yourself or lost something? Emergency numbers and what to do in Korea.$t$, 'bodyMd', $t$## Emergency numbers
| Situation | Number |
| --- | --- |
| Police (crime, incidents) | 112 |
| Fire and ambulance (emergency room) | 119 |
| Tourist helpline for foreigners (24 hours, multilingual) | 1330 |

## If you get sick
- For minor symptoms, pharmacies (look for the green cross sign) sell medicine without a prescription.
- Emergency rooms are at major hospitals (Seoul National University Hospital, Severance and others) and treat foreign patients. You usually pay first and claim it back from your travel insurance after you return home.

## Lost or stolen items
- For items left on the subway or a bus, contact the Seoul Metro Lost and Found Center or the customer center for that line.
- If you lose your passport, get a loss report from the nearest police station, then contact your country's embassy or consulate in Korea to obtain an emergency passport.

## Help around the clock
- 1330 (Korea Travel Hotline) connects you 24 hours a day in English, Chinese, Japanese and other languages. Beyond emergencies, it can help with directions and interpreting.
$t$),
'ja', jsonb_build_object('title', $t$韓国旅行中の緊急時対応ガイド$t$, 'summary', $t$ケガをした、物をなくした — 韓国で知っておきたい緊急連絡先と対処法。$t$, 'bodyMd', $t$## 緊急連絡先
| 状況 | 番号 |
| --- | --- |
| 犯罪・事件事故の通報 | 112 |
| 火災・救急(救急外来) | 119 |
| 外国人観光案内(24時間・多言語) | 1330 |

## 体調が悪いとき
- 軽い症状なら、薬局(緑の十字の看板)で処方箋なしで薬を買えます。
- 救急外来は大きな病院(ソウル大学病院、セブランス病院など)にあり、外国人も受診できます。医療費はいったん自分で支払い、帰国後に海外旅行保険で請求するのが一般的です。

## 紛失・盗難
- 地下鉄やバスでの忘れ物は、ソウル交通公社の遺失物センターまたは各路線のお客様センターに問い合わせます。
- パスポートをなくした場合は、近くの警察署で紛失届の受理証明を受け取り、在韓の自国大使館・領事館に連絡して緊急旅券を発給してもらいます。

## 24時間サポートが必要なとき
- 1330(コリア・トラベル・ヘルプライン)は英語・中国語・日本語など多言語で24時間つながります。緊急時でなくても、道案内や通訳の手配が可能です。
$t$),
'zh-CN', jsonb_build_object('title', $t$韩国旅行紧急情况应对指南$t$, 'summary', $t$受伤或丢了东西怎么办?在韩国需要知道的紧急联系方式和应对方法。$t$, 'bodyMd', $t$## 紧急联系方式
| 情况 | 电话 |
| --- | --- |
| 报警(犯罪、事故) | 112 |
| 火警·急救(急诊) | 119 |
| 外国游客旅游咨询(24小时、多语种) | 1330 |

## 生病时
- 症状较轻时,可在药店(绿色十字招牌)无需处方买药。
- 急诊室设在大医院(首尔大学医院、Severance医院等),外国人也可就诊。通常需先自付医疗费,回国后再向旅游保险理赔。

## 物品遗失或被盗
- 在地铁或公交上遗失物品,可联系首尔交通公社失物招领中心或相应线路的客服中心。
- 护照丢失时,先到附近警察局开具遗失证明,再联系本国驻韩大使馆或领事馆办理临时护照。

## 需要24小时帮助时
- 1330(韩国旅游热线)提供英语、中文、日语等多语种24小时服务。即使不是紧急情况,也可以帮忙指路或转接翻译。
$t$),
'zh-TW', jsonb_build_object('title', $t$韓國旅行緊急狀況應對指南$t$, 'summary', $t$受傷或東西不見了怎麼辦?在韓國要知道的緊急聯絡方式與應對方法。$t$, 'bodyMd', $t$## 緊急聯絡電話
| 狀況 | 電話 |
| --- | --- |
| 報案(犯罪、事故) | 112 |
| 火警・救護(急診) | 119 |
| 外國旅客觀光諮詢(24小時、多語) | 1330 |

## 生病時
- 症狀輕微時,可在藥局(綠色十字招牌)不需處方就買藥。
- 急診室設在大醫院(首爾大學醫院、Severance醫院等),外國人也能就診。通常要先自付醫療費,回國後再向旅遊保險申請理賠。

## 物品遺失或遭竊
- 在地鐵或公車上遺失物品,可洽首爾交通公社失物招領中心或該路線的客服中心。
- 護照遺失時,先到附近警察局取得遺失證明,再聯絡本國駐韓大使館或領事館申請臨時護照。

## 需要24小時協助時
- 1330(韓國旅遊熱線)提供英語、中文、日語等多語24小時服務。就算不是緊急狀況,也能幫忙指路或轉接口譯。
$t$),
'es', jsonb_build_object('title', $t$Qué hacer en caso de emergencia durante tu viaje por Corea$t$, 'summary', $t$¿Te has hecho daño o has perdido algo? Números de emergencia y qué hacer en Corea.$t$, 'bodyMd', $t$## Números de emergencia
| Situación | Número |
| --- | --- |
| Policía (delitos, incidentes) | 112 |
| Bomberos y ambulancia (urgencias) | 119 |
| Línea de ayuda al turista extranjero (24 horas, multilingüe) | 1330 |

## Si te encuentras mal
- Para síntomas leves, las farmacias (busca la cruz verde) venden medicamentos sin receta.
- Los servicios de urgencias están en los grandes hospitales (Hospital de la Universidad Nacional de Seúl, Severance y otros) y atienden a pacientes extranjeros. Normalmente pagas primero y lo reclamas a tu seguro de viaje al volver a casa.

## Objetos perdidos o robados
- Si olvidas algo en el metro o el autobús, contacta con el Centro de Objetos Perdidos de Seoul Metro o con el centro de atención de esa línea.
- Si pierdes el pasaporte, consigue un justificante de pérdida en la comisaría más cercana y contacta con la embajada o el consulado de tu país en Corea para obtener un pasaporte de emergencia.

## Ayuda a cualquier hora
- El 1330 (Korea Travel Hotline) te atiende las 24 horas en inglés, chino, japonés y otros idiomas. Además de emergencias, te ayuda con indicaciones y servicios de interpretación.
$t$),
'fr', jsonb_build_object('title', $t$Gérer une urgence pendant un voyage en Corée$t$, 'summary', $t$Blessé ou victime d'une perte ? Numéros d'urgence et marche à suivre en Corée.$t$, 'bodyMd', $t$## Numéros d'urgence
| Situation | Numéro |
| --- | --- |
| Police (délits, incidents) | 112 |
| Pompiers et ambulance (urgences) | 119 |
| Assistance aux touristes étrangers (24 h/24, multilingue) | 1330 |

## En cas de maladie
- Pour des symptômes légers, les pharmacies (repérez la croix verte) délivrent des médicaments sans ordonnance.
- Les services d'urgence se trouvent dans les grands hôpitaux (hôpital de l'Université nationale de Séoul, Severance, etc.) et soignent les patients étrangers. En général, vous payez sur place puis vous vous faites rembourser par votre assurance voyage à votre retour.

## Objets perdus ou volés
- Pour un objet oublié dans le métro ou le bus, contactez le centre des objets trouvés de Seoul Metro ou le service client de la ligne concernée.
- Si vous perdez votre passeport, obtenez une déclaration de perte au commissariat le plus proche, puis contactez l'ambassade ou le consulat de votre pays en Corée pour obtenir un passeport d'urgence.

## Aide à toute heure
- Le 1330 (Korea Travel Hotline) répond 24 h/24 en anglais, chinois, japonais et dans d'autres langues. Au-delà des urgences, il peut vous aider à trouver votre chemin ou vous mettre en relation avec un interprète.
$t$),
'de', jsonb_build_object('title', $t$Notfälle auf Reisen in Korea – was tun?$t$, 'summary', $t$Verletzt oder etwas verloren? Notrufnummern und das richtige Vorgehen in Korea.$t$, 'bodyMd', $t$## Notrufnummern
| Situation | Nummer |
| --- | --- |
| Polizei (Straftaten, Vorfälle) | 112 |
| Feuerwehr und Rettungsdienst (Notaufnahme) | 119 |
| Touristen-Hotline für Ausländer (24 Stunden, mehrsprachig) | 1330 |

## Wenn Sie krank werden
- Bei leichten Beschwerden bekommen Sie in Apotheken (grünes Kreuz) Medikamente ohne Rezept.
- Notaufnahmen gibt es in großen Krankenhäusern (Seoul National University Hospital, Severance u. a.), die auch ausländische Patienten behandeln. In der Regel zahlen Sie zuerst selbst und reichen die Kosten nach der Rückkehr bei Ihrer Reiseversicherung ein.

## Verlust oder Diebstahl
- Bei in U-Bahn oder Bus vergessenen Gegenständen wenden Sie sich an das Fundbüro von Seoul Metro oder das Kundencenter der jeweiligen Linie.
- Wenn Sie Ihren Reisepass verlieren, lassen Sie sich bei der nächsten Polizeistation eine Verlustbescheinigung ausstellen und kontaktieren Sie dann die Botschaft oder das Konsulat Ihres Landes in Korea, um einen Notpass zu erhalten.

## Hilfe rund um die Uhr
- Die 1330 (Korea Travel Hotline) ist 24 Stunden am Tag auf Englisch, Chinesisch, Japanisch und in weiteren Sprachen erreichbar. Auch außerhalb von Notfällen hilft sie bei Wegbeschreibungen und vermittelt Dolmetscher.
$t$),
'ru', jsonb_build_object('title', $t$Что делать в экстренной ситуации во время поездки по Корее$t$, 'summary', $t$Травма или потеря вещей? Номера экстренных служб и порядок действий в Корее.$t$, 'bodyMd', $t$## Экстренные номера
| Ситуация | Номер |
| --- | --- |
| Полиция (преступления, происшествия) | 112 |
| Пожарные и скорая помощь (приёмный покой) | 119 |
| Справочная для иностранных туристов (24 часа, на разных языках) | 1330 |

## Если вы заболели
- При лёгких симптомах лекарства можно купить в аптеке (вывеска с зелёным крестом) без рецепта.
- Приёмные отделения есть в крупных больницах (больница Сеульского национального университета, Severance и др.), иностранцев там принимают. Обычно вы сначала платите сами, а после возвращения домой получаете компенсацию по туристической страховке.

## Потеря или кража
- Если вы забыли вещь в метро или автобусе, обратитесь в бюро находок Seoul Metro или в клиентский центр соответствующей линии.
- Если вы потеряли паспорт, получите справку о потере в ближайшем полицейском участке, затем свяжитесь с посольством или консульством своей страны в Корее, чтобы оформить временный паспорт.

## Помощь круглосуточно
- По номеру 1330 (Korea Travel Hotline) круглосуточно отвечают на английском, китайском, японском и других языках. Помимо экстренных случаев, там помогут сориентироваться и подключат переводчика.
$t$)
) where slug = 'foreigner-korea-emergency-guide';

-- 확인: 6개 가이드 모두 missing이 비어 있어야 한다
select slug,
  (select string_agg(l, ',') from unnest(array['en','ja','zh-CN','zh-TW','es','fr','de','ru']) l where not translations ? l) as missing
from guide_articles
where slug like 'foreigner-korea-%'
order by slug;
